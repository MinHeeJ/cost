package cost.codegroups;

import cost.CostApplication;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 전용 disposable DB에서만 실행하며 normal Flyway와 Spring transaction rollback을 검증한다. */
@EnabledIfEnvironmentVariable(named = "CODEGROUPS_DISPOSABLE_DB", matches = "true")
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
@SpringBootTest(classes = CostApplication.class)
@AutoConfigureMockMvc
class CodePostgresTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate jdbc;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "cost"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
    }

    @AfterEach
    void removeFailureConstraint() {
        jdbc.execute("ALTER TABLE si_cost.cm_code_history DROP CONSTRAINT IF EXISTS codegroups_history_failure");
    }

    Map<String, Object> snapshot() {
        return Map.of(
            "groups", snapshotTable("cm_code_group", "group_code"),
            "codes", snapshotTable("cm_code", "group_code, code"),
            "history", snapshotTable("cm_code_history", "hist_id"),
            "mapping", snapshotTable("cm_excel_mapping", "mapping_id"),
            "param", snapshotTable("cm_param", "param_key, effective_from")
        );
    }

    String snapshotTable(String table, String order) {
        // Identifiers are test-owned constants, never request input.
        return jdbc.queryForObject("SELECT COALESCE(json_agg(t), '[]'::json)::text FROM "
            + "(SELECT * FROM si_cost." + table + " ORDER BY " + order + ") t", String.class);
    }

    @Test
    void readsHaveNoDatabaseOrAuditSideEffects() throws Exception {
        Map<String, Object> before = snapshot();
        mvc.perform(get("/api/admin/code-groups"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        mvc.perform(get("/api/admin/code-groups/{group}/codes", "POSITION"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void groupAndAllHistoryRollBackWhenHistoryInsertFails() throws Exception {
        Map<String, Object> before = snapshot();
        jdbc.execute("ALTER TABLE si_cost.cm_code_history ADD CONSTRAINT codegroups_history_failure "
            + "CHECK (group_code <> 'ROLLBACK_GROUP')");
        mvc.perform(post("/api/admin/code-groups").contentType("application/json").content("""
            {"group_code":"ROLLBACK_GROUP","group_name":"rollback test"}
            """))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void actualMapperUpdateAndHistoryFailureRollBackTogether() throws Exception {
        Map<String, Object> before = snapshot();
        jdbc.execute("ALTER TABLE si_cost.cm_code_history ADD CONSTRAINT codegroups_history_failure "
            + "CHECK (NOT (group_code = 'POSITION' AND after_value = 'rollback test'))");
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        String data = mvc.perform(get("/api/admin/code-groups/{group}/codes", "POSITION"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var rows = mapper.readTree(data).get("data");
        for (var row : rows) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) row).remove("group_code");
            if (row.get("code").asText().equals("TL")) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) row).put("code_name", "rollback test");
            }
        }
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content(rows.toString()))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"));
        assertThat(snapshot()).isEqualTo(before);
    }
}
