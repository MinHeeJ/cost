package cost.common;

import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import java.sql.Connection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real Spring transaction interception with a mocked JDBC boundary; not PostgreSQL durability evidence. */
class CodeHistoryWriterTest {
    CodeHistoryWriteMapper mapper;
    CodeHistoryWriter writer;
    Connection connection;
    TransactionTemplate transaction;

    @BeforeEach
    void setup() throws Exception {
        mapper = mock(CodeHistoryWriteMapper.class);
        when(mapper.insert(any())).thenReturn(1);
        connection = mock(Connection.class);
        when(connection.getAutoCommit()).thenReturn(true);
        DataSource source = mock(DataSource.class);
        when(source.getConnection()).thenReturn(connection);
        var manager = new DataSourceTransactionManager(source);
        transaction = new TransactionTemplate(manager);
        var factory = new ProxyFactory(new CodeHistoryWriter(mapper, new CurrentUser()));
        factory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        writer = (CodeHistoryWriter) factory.getProxy();
    }

    @Test
    void changedAllowanceRecordsOneColumnWithNullActor() throws Exception {
        transaction.executeWithoutResult(status -> writer.recordChanges("POSITION", "TL",
            Map.of("attr1", "200000", "code_name", "팀장"),
            Map.of("attr1", "250000", "code_name", "팀장")));
        var entry = capture();
        assertThat(entry.getGroupCode()).isEqualTo("POSITION");
        assertThat(entry.getCode()).isEqualTo("TL");
        assertThat(entry.getAction()).isEqualTo("UPDATE");
        assertThat(entry.getFieldName()).isEqualTo("attr1");
        assertThat(entry.getBeforeValue()).isEqualTo("200000");
        assertThat(entry.getAfterValue()).isEqualTo("250000");
        assertThat(entry.getChangedBy()).isNull();
        verify(connection).commit();
        verify(connection, never()).rollback();
    }

    @ParameterizedTest
    @CsvSource({"Y,N,DISABLE", "N,Y,ENABLE"})
    void useFlagTransitionsHaveDistinctActions(String before, String after, String action) {
        transaction.executeWithoutResult(status -> writer.recordChanges("JOB", "OPS",
            Map.of("use_yn", before), Map.of("use_yn", after)));
        assertThat(capture().getAction()).isEqualTo(action);
    }

    @Test
    void noOpMakesNoHistory() {
        transaction.executeWithoutResult(status -> writer.recordChanges("JOB", "BE",
            Map.of("code_name", "개발"), Map.of("code_name", "개발")));
        verifyNoInteractions(mapper);
    }

    @Test
    void groupAdditionUsesNullCodeAndIncludesNullAttribute() {
        var after = new LinkedHashMap<String, Object>();
        after.put("group_name", "업무");
        after.put("attr1_label", null);
        transaction.executeWithoutResult(status -> writer.recordChanges("BUSINESS", null, null, after));
        var captured = ArgumentCaptor.forClass(CodeHistoryEntry.class);
        verify(mapper, times(2)).insert(captured.capture());
        assertThat(captured.getAllValues()).allSatisfy(entry -> {
            assertThat(entry.getCode()).isNull();
            assertThat(entry.getAction()).isEqualTo("ADD");
            assertThat(entry.getBeforeValue()).isNull();
            assertThat(entry.getChangedBy()).isNull();
        });
        assertThat(captured.getAllValues().get(1).getAfterValue()).isNull();
    }

    @Test
    void paramUsesParamGroupAndKeyAsCode() {
        transaction.executeWithoutResult(status -> writer.recordChanges("PARAM", "VAT_RATE", null,
            Map.of("num_value", new java.math.BigDecimal("11"))));
        var entry = capture();
        assertThat(entry.getGroupCode()).isEqualTo("PARAM");
        assertThat(entry.getCode()).isEqualTo("VAT_RATE");
        assertThat(entry.getAfterValue()).isEqualTo("11");
    }

    @Test
    void mappingUsesTargetGroupAndCodeAndExplicitNullClearsNote() {
        var after = new LinkedHashMap<String, Object>();
        after.put("note", null);
        transaction.executeWithoutResult(status -> writer.recordChanges("JOB", "OPS",
            Map.of("note", "이전 메모"), after));
        var entry = capture();
        assertThat(entry.getGroupCode()).isEqualTo("JOB");
        assertThat(entry.getCode()).isEqualTo("OPS");
        assertThat(entry.getBeforeValue()).isEqualTo("이전 메모");
        assertThat(entry.getAfterValue()).isNull();
    }

    @Test
    void longParamKeyIsRejectedBeforeInsert() {
        assertThatThrownBy(() -> transaction.executeWithoutResult(status ->
            writer.recordChanges("PARAM", "K".repeat(31), null, Map.of("num_value", 11))))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getStatus()).isEqualTo(400);
                assertThat(error.getField()).isEqualTo("key");
            });
        verifyNoInteractions(mapper);
    }

    @Test
    void oversizedLaterValueDoesNotInsertEarlierField() {
        var after = new LinkedHashMap<String, Object>();
        after.put("code_name", "정상");
        after.put("note", "x".repeat(501));
        assertThatThrownBy(() -> transaction.executeWithoutResult(status ->
            writer.recordChanges("JOB", "BE", null, after))).isInstanceOf(ApiException.class);
        verifyNoInteractions(mapper);
    }

    @Test
    void writerRefusesIndependentTransaction() {
        assertThatThrownBy(() -> writer.recordChanges("JOB", "BE", null, Map.of("code_name", "개발")))
            .isInstanceOf(IllegalTransactionStateException.class);
        verifyNoInteractions(mapper);
    }

    @Test
    void failedInsertRollsBackCallingTransaction() throws Exception {
        when(mapper.insert(any())).thenReturn(1).thenThrow(new IllegalStateException("SQL private"));
        var after = new LinkedHashMap<String, Object>();
        after.put("code_name", "개발");
        after.put("use_yn", "Y");
        assertThatThrownBy(() -> transaction.executeWithoutResult(status ->
            writer.recordChanges("JOB", "BE", null, after))).isInstanceOf(IllegalStateException.class);
        verify(mapper, times(2)).insert(any());
        verify(connection).rollback();
        verify(connection, never()).commit();
    }

    @Test
    void zeroAffectedRowsIsFailureAndRollsBack() throws Exception {
        when(mapper.insert(any())).thenReturn(0);
        assertThatThrownBy(() -> transaction.executeWithoutResult(status ->
            writer.recordChanges("JOB", "BE", null, Map.of("code_name", "개발"))))
            .isInstanceOf(IllegalStateException.class);
        verify(connection).rollback();
    }

    private CodeHistoryEntry capture() {
        var captured = ArgumentCaptor.forClass(CodeHistoryEntry.class);
        verify(mapper).insert(captured.capture());
        return captured.getValue();
    }
}
