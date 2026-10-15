package cost.excelmappings;

import cost.common.CodeHistoryEntry;
import cost.common.CodeHistoryWriteMapper;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 명시적으로 제공된 전용 DB에서만 정상 Flyway와 실제 Spring/MyBatis rollback을 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariables({
    @EnabledIfEnvironmentVariable(named = "TEST_EXCEL_DB_URL", matches = ".+"),
    @EnabledIfEnvironmentVariable(named = "TEST_EXCEL_DB_DEDICATED", matches = "true")
})
class ExcelMappingPostgresTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @SpyBean CodeHistoryWriteMapper histories;
    String label;
    long previousHistory;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> System.getenv("TEST_EXCEL_DB_URL"));
        properties.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "cost"));
        properties.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
    }

    @BeforeEach
    void snapshotDedicatedDatabase() {
        label = "대응 시험 " + UUID.randomUUID();
        previousHistory = jdbc.queryForObject(
            "SELECT COALESCE(MAX(hist_id), 0) FROM si_cost.cm_code_history", Long.class);
    }

    @AfterEach
    void restoreOwnDedicatedFixture() {
        reset(histories);
        jdbc.update("DELETE FROM si_cost.cm_excel_mapping WHERE excel_label = ?", label);
        jdbc.update("DELETE FROM si_cost.cm_code_history WHERE hist_id > ?", previousHistory);
    }

    @Test
    void createAndPatchPersistInactiveCodeNamesAndColumnHistoriesWithoutChangingCodes() throws Exception {
        String codes = snapshot("si_cost.cm_code", "group_code, code");
        create().andExpect(status().isOk()).andExpect(jsonPath("$.data.code_name").isString());
        assertThat(jdbc.queryForObject(
            "SELECT COUNT(*) FROM si_cost.cm_code_history WHERE hist_id > ? AND action = 'ADD' "
                + "AND group_code = 'JOB' AND code = 'OPS' AND changed_by IS NULL",
            Integer.class, previousHistory)).isEqualTo(6);
        patchRow("{\"note\":null,\"map_role\":\"SUB\",\"use_yn\":\"N\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.note").isEmpty());
        assertThat(jdbc.queryForList(
            "SELECT action, field_name, before_value, after_value FROM si_cost.cm_code_history "
                + "WHERE hist_id > ? AND action != 'ADD' ORDER BY hist_id", previousHistory))
            .containsExactly(
                Map.of("action", "UPDATE", "field_name", "map_role", "before_value", "MAIN", "after_value", "SUB"),
                nullableNoteHistory(),
                Map.of("action", "DISABLE", "field_name", "use_yn", "before_value", "Y", "after_value", "N"));
        String mappings = snapshot("si_cost.cm_excel_mapping", "mapping_id");
        String audit = snapshot("si_cost.cm_code_history", "hist_id");
        mvc.perform(get("/api/admin/excel-mappings")).andExpect(status().isOk());
        patchRow("{\"note\":null}").andExpect(status().isOk());
        assertThat(snapshot("si_cost.cm_excel_mapping", "mapping_id")).isEqualTo(mappings);
        assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(audit);
        assertThat(snapshot("si_cost.cm_code", "group_code, code")).isEqualTo(codes);
    }

    @Test
    void inactiveReferencedCodeRemainsNamedAndGetDoesNotMutateTables() {
        var template = new org.springframework.transaction.support.TransactionTemplate(transactions);
        template.executeWithoutResult(transaction -> {
            jdbc.update("UPDATE si_cost.cm_code SET use_yn = 'N' WHERE group_code = 'JOB' AND code = 'OPS'");
            String mappings = snapshot("si_cost.cm_excel_mapping", "mapping_id");
            String audit = snapshot("si_cost.cm_code_history", "hist_id");
            String codes = snapshot("si_cost.cm_code", "group_code, code");
            try {
                mvc.perform(get("/api/admin/excel-mappings"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[?(@.target_code == 'OPS')].code_name").isNotEmpty());
                assertThat(snapshot("si_cost.cm_excel_mapping", "mapping_id")).isEqualTo(mappings);
                assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(audit);
                assertThat(snapshot("si_cost.cm_code", "group_code, code")).isEqualTo(codes);
            } catch (Exception error) {
                throw new AssertionError(error);
            } finally {
                transaction.setRollbackOnly();
            }
        });
    }

    @Test
    void createHistoryFailureAfterFirstInsertRollsBackMappingAndPartialHistory() throws Exception {
        String mappings = snapshot("si_cost.cm_excel_mapping", "mapping_id");
        String audit = snapshot("si_cost.cm_code_history", "hist_id");
        AtomicInteger calls = failSecondHistory();
        create().andExpect(status().isInternalServerError());
        assertThat(calls.get()).isEqualTo(2);
        assertThat(snapshot("si_cost.cm_excel_mapping", "mapping_id")).isEqualTo(mappings);
        assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(audit);
    }

    @Test
    void patchHistoryFailureAfterFirstInsertRollsBackOriginalAndPartialHistory() throws Exception {
        create().andExpect(status().isOk());
        String mappings = snapshot("si_cost.cm_excel_mapping", "mapping_id");
        String audit = snapshot("si_cost.cm_code_history", "hist_id");
        AtomicInteger calls = failSecondHistory();
        patchRow("{\"note\":\"변경\",\"map_role\":\"SUB\"}").andExpect(status().isInternalServerError());
        assertThat(calls.get()).isEqualTo(2);
        assertThat(snapshot("si_cost.cm_excel_mapping", "mapping_id")).isEqualTo(mappings);
        assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(audit);
    }

    private AtomicInteger failSecondHistory() {
        AtomicInteger count = new AtomicInteger();
        doAnswer(call -> {
            if (count.incrementAndGet() == 2) throw new IllegalStateException("history failure");
            return call.callRealMethod();
        }).when(histories).insert(any(CodeHistoryEntry.class));
        return count;
    }

    private Map<String, Object> nullableNoteHistory() {
        var row = new java.util.LinkedHashMap<String, Object>();
        row.put("action", "UPDATE");
        row.put("field_name", "note");
        row.put("before_value", "메모");
        row.put("after_value", null);
        return row;
    }

    private org.springframework.test.web.servlet.ResultActions create() throws Exception {
        String body = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(Map.of(
            "excel_label", label, "target_group", "JOB", "target_code", "OPS", "map_role", "MAIN", "note", "메모"));
        return mvc.perform(post("/api/admin/excel-mappings").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private org.springframework.test.web.servlet.ResultActions patchRow(String body) throws Exception {
        return mvc.perform(patch("/api/admin/excel-mappings").param("excel_label", label)
            .param("target_group", "JOB").param("target_code", "OPS")
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private String snapshot(String table, String order) {
        return jdbc.queryForObject("SELECT COALESCE(json_agg(t ORDER BY " + order + ")::text, '[]') FROM "
            + table + " t", String.class);
    }
}
