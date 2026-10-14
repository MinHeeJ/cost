package cost.params;

import com.fasterxml.jackson.databind.node.TextNode;
import cost.common.*;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 공통 writer 시험과 동일한 JDBC-double로 실제 Spring transaction 프록시 참여를 검증한다. */
class ParamServiceTest {
    ParamMapper mapper;
    CodeHistoryWriteMapper history;
    Connection connection;
    ParamService service;
    ParamItem original;

    @BeforeEach
    void realTransactionInterceptionWithMockedJdbcBoundary() throws Exception {
        mapper = mock(ParamMapper.class);
        history = mock(CodeHistoryWriteMapper.class);
        connection = mock(Connection.class);
        when(connection.getAutoCommit()).thenReturn(true);
        DataSource source = mock(DataSource.class);
        when(source.getConnection()).thenReturn(connection);
        var manager = new DataSourceTransactionManager(source);
        var writerFactory = new ProxyFactory(new CodeHistoryWriter(history, new CurrentUser()));
        writerFactory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        CodeHistoryWriter writer = (CodeHistoryWriter) writerFactory.getProxy();
        var serviceFactory = new ProxyFactory(new ParamService(
            new ParamAdapter(mapper), writer, new CurrentUser(), new PermissionService(),
            Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"), ZoneId.of("Asia/Seoul"))));
        serviceFactory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        service = (ParamService) serviceFactory.getProxy();
        original = new ParamItem();
        original.setParamKey("VAT_RATE");
        original.setEffectiveFrom("2000-01");
        original.setParamName("부가세율");
        original.setNumValue(new BigDecimal("10"));
        when(mapper.lockHistory("VAT_RATE")).thenReturn(List.of(original));
        when(mapper.selectLastClosed()).thenReturn("2026-09");
        when(mapper.insert(any())).thenReturn(1);
        when(history.insert(any())).thenReturn(1);
    }

    private UpdateParamRequest input() {
        var request = new UpdateParamRequest();
        request.setEffectiveFrom(TextNode.valueOf("2026-11"));
        request.setNumValue(new BigDecimal("11"));
        return request;
    }

    @Test
    void domainInsertAndAllHistoryShareOneCommit() throws Exception {
        service.updateParam("VAT_RATE", input());
        var order = inOrder(mapper, history, connection);
        order.verify(mapper).lockHistory("VAT_RATE");
        order.verify(mapper).selectLastClosed();
        order.verify(mapper).insert(any());
        order.verify(history, times(2)).insert(any());
        order.verify(connection).commit();
        verify(connection, never()).rollback();
        assertThat(original.getNumValue()).isEqualByComparingTo("10");
    }

    @Test
    void secondHistoryFailureRollsBackDomainWriteWithoutIndependentCommit() throws Exception {
        when(history.insert(any())).thenReturn(1).thenThrow(new IllegalStateException("SQL private"));
        assertThatThrownBy(() -> service.updateParam("VAT_RATE", input()))
            .isInstanceOf(IllegalStateException.class);
        verify(mapper).insert(any());
        verify(history, times(2)).insert(any());
        verify(connection).rollback();
        verify(connection, never()).commit();
    }

    @Test
    void zeroAffectedDomainRowsRollsBackBeforeHistory() throws Exception {
        when(mapper.insert(any())).thenReturn(0);
        assertThatThrownBy(() -> service.updateParam("VAT_RATE", input()))
            .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(history);
        verify(connection).rollback();
        verify(connection, never()).commit();
    }
}
