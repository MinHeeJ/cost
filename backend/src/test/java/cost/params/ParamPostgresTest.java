package cost.params;

import cost.common.CodeHistoryEntry;
import cost.common.CodeHistoryWriteMapper;
import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 전용 DB opt-in. 정상 Boot/Flyway와 Spring transaction으로 원본·이력 rollback을 검증한다. */
@EnabledIfEnvironmentVariable(named = "TEST_PARAMS_DB_URL", matches = ".+")
@SpringBootTest
@AutoConfigureMockMvc
class ParamPostgresTest {
    private static final String KEY = "PARAM_CONTRACT";
    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate jdbc;
    @SpyBean
    CodeHistoryWriteMapper historyMapper;

    @DynamicPropertySource
    static void dedicatedDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TEST_PARAMS_DB_URL"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "cost"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
    }

    @BeforeEach
    void insertIsolatedFixtureWithoutChangingExistingSeeds() {
        jdbc.update("""
            INSERT INTO si_cost.cm_param (
                param_key, effective_from, param_name, num_value, unit, used_in, description
            )
            VALUES (?, '2000-01', '시험 기준값', 10, '단위', '사용처', '설명')
            """, KEY);
    }

    @AfterEach
    void removeOnlyOwnedFixture() {
        reset(historyMapper);
        jdbc.update("DELETE FROM si_cost.cm_code_history WHERE group_code = 'PARAM' AND code = ?", KEY);
        jdbc.update("DELETE FROM si_cost.cm_param WHERE param_key = ?", KEY);
    }

    @Test
    void realXmlAppendAndUpdatePreserveMetadataAndReadOperationsAreImmutable() throws Exception {
        String months = snapshot("public.fin_month_close", "close_month");
        mvc.perform(put("/api/admin/params/{key}", KEY)
                .contentType("application/json")
                .content("{\"effective_from\":\"9998-11\",\"num_value\":11}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(11));
        assertThat(jdbc.queryForObject("""
            SELECT num_value
            FROM si_cost.cm_param
            WHERE param_key = ? AND effective_from = '2000-01'
            """, BigDecimal.class, KEY)).isEqualByComparingTo("10");
        assertThat(jdbc.queryForObject("""
            SELECT description
            FROM si_cost.cm_param
            WHERE param_key = ? AND effective_from = '9998-11'
            """, String.class, KEY)).isEqualTo("설명");
        mvc.perform(put("/api/admin/params/{key}", KEY)
                .contentType("application/json")
                .content("{\"effective_from\":\"9998-11\",\"num_value\":12}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(12));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM si_cost.cm_param WHERE param_key = ?",
            Integer.class, KEY)).isEqualTo(2);
        assertThat(jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM si_cost.cm_code_history
            WHERE group_code = 'PARAM' AND code = ? AND action = 'UPDATE'
                AND field_name = 'num_value' AND before_value = '11' AND after_value = '12'
                AND changed_by IS NULL
            """, Integer.class, KEY)).isEqualTo(1);
        String params = snapshot("si_cost.cm_param", "param_key, t.effective_from");
        String audit = snapshot("si_cost.cm_code_history", "hist_id");
        mvc.perform(get("/api/admin/params")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/params/{key}/history", KEY))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].effective_from").value("9998-11"))
            .andExpect(jsonPath("$.data[1].num_value").value(10));
        assertThat(snapshot("si_cost.cm_param", "param_key, t.effective_from")).isEqualTo(params);
        assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(audit);
        assertThat(snapshot("public.fin_month_close", "close_month")).isEqualTo(months);
    }

    @Test
    void secondHistoryFailureRollsBackInsertedParamAndFirstHistoryRowOnRealDatabase() throws Exception {
        String params = snapshot("si_cost.cm_param", "param_key, t.effective_from");
        String audit = snapshot("si_cost.cm_code_history", "hist_id");
        AtomicInteger writes = new AtomicInteger();
        doAnswer(call -> {
            if (writes.incrementAndGet() == 2) throw new IllegalStateException("injected history failure");
            CodeHistoryEntry entry = call.getArgument(0);
            return jdbc.update("""
                INSERT INTO si_cost.cm_code_history (
                    group_code, code, action, field_name, before_value, after_value, changed_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, entry.getGroupCode(), entry.getCode(), entry.getAction(), entry.getFieldName(),
                entry.getBeforeValue(), entry.getAfterValue(), entry.getChangedBy());
        }).when(historyMapper).insert(any());
        mvc.perform(put("/api/admin/params/{key}", KEY)
                .contentType("application/json")
                .content("{\"effective_from\":\"9998-11\",\"num_value\":11}"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"));
        assertThat(writes.get()).isEqualTo(2);
        assertThat(snapshot("si_cost.cm_param", "param_key, t.effective_from")).isEqualTo(params);
        assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(audit);
    }

    private String snapshot(String table, String order) {
        return jdbc.queryForObject("SELECT json_agg(t ORDER BY t." + order + ")::text FROM " + table + " t",
            String.class);
    }
}
