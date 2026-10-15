package cost.adminops;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariables;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 옵트인 전용 DB에서 실제 XML materialization·정렬·조회 불변을 검증하고 fixture를 롤백한다. */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariables({
    @EnabledIfEnvironmentVariable(named = "TEST_HISTORY_DB_URL", matches = ".+"),
    @EnabledIfEnvironmentVariable(named = "TEST_HISTORY_DB_DEDICATED", matches = "true")
})
@Transactional
class CodeHistoryPostgresTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    ObjectMapper json;
    String group;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> System.getenv("TEST_HISTORY_DB_URL"));
        properties.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "cost"));
        properties.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
    }

    @BeforeEach
    void fixtureInRollbackTransaction() {
        group = "H_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        jdbc.update("""
            INSERT INTO si_cost.cm_code_group (group_code, group_name)
            VALUES (?, '이력 시험')
            """, group);
    }

    @Test
    void actualMapperFiltersCountsPaginatesAndBreaksTimestampTiesWithoutChangingAnyTable() throws Exception {
        for (int index = 0; index < 23; index++) {
            history(group, "ROW_" + index, "ADD", "code_name", null, "이름 " + index, null);
        }
        Map<String, String> before = snapshot();
        var first = mvc.perform(get("/api/admin/code-history").param("group", group).param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(23))
            .andExpect(jsonPath("$.data.items.length()").value(20))
            .andExpect(jsonPath("$.data.items[0].group_name").value("이력 시험"))
            .andExpect(jsonPath("$.data.items[0].before_value").isEmpty())
            .andExpect(jsonPath("$.data.items[0].changed_by").isEmpty())
            .andReturn();
        var second = mvc.perform(get("/api/admin/code-history").param("group", group)
                .param("size", "20").param("page", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(23))
            .andExpect(jsonPath("$.data.items.length()").value(3))
            .andReturn();
        var firstItems = json.readTree(first.getResponse().getContentAsString()).path("data").path("items");
        var secondItems = json.readTree(second.getResponse().getContentAsString()).path("data").path("items");
        for (int index = 0; index < 20; index++) {
            assertThat(firstItems.get(index).path("code").asText()).isEqualTo("ROW_" + (22 - index));
            assertThat(firstItems.get(index).path("group_code").asText()).isEqualTo(group);
        }
        for (int index = 0; index < 3; index++) {
            assertThat(secondItems.get(index).path("code").asText()).isEqualTo("ROW_" + (2 - index));
        }
        mvc.perform(get("/api/admin/code-history").param("group", group).param("page", "4"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items").isEmpty())
            .andExpect(jsonPath("$.data.total").value(23));
        mvc.perform(get("/api/admin/code-history").param("group", "UNKNOWN_" + group))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(0));
        mvc.perform(get("/api/admin/code-history").param("page", "0"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("page"));
        mvc.perform(get("/api/admin/code-history").param("size", "25"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("size"));
        mvc.perform(get("/api/admin/code-history").param("group", ""))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("group"));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void publicHistoryMaterializesTlOpsParamAndNullableGroupAddWithLatestFirst() throws Exception {
        history("POSITION", "TL", "UPDATE", "attr1", "200000", "250000", null);
        history("JOB", "OPS", "DISABLE", "use_yn", "Y", "N", null);
        history("PARAM", "VAT_RATE", "UPDATE", "num_value", "10", "11", 9007199254740993L);
        history(group, null, "ADD", "group_name", null, "이력 시험", null);
        Map<String, String> before = snapshot();
        mvc.perform(get("/api/admin/code-history"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].code").isEmpty())
            .andExpect(jsonPath("$.data.items[0].action").value("ADD"))
            .andExpect(jsonPath("$.data.items[1].group_name").value("기준값"))
            .andExpect(jsonPath("$.data.items[1].changed_by").value("9007199254740993"))
            .andExpect(jsonPath("$.data.items[2].code").value("OPS"))
            .andExpect(jsonPath("$.data.items[2].action").value("DISABLE"))
            .andExpect(jsonPath("$.data.items[3].code").value("TL"))
            .andExpect(jsonPath("$.data.items[3].before_value").value("200000"))
            .andExpect(jsonPath("$.data.items[3].after_value").value("250000"))
            .andExpect(jsonPath("$.data.items[3].changed_by").isEmpty());
        mvc.perform(get("/api/admin/code-history").param("group", "PARAM"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].group_name").value("기준값"));
        assertThat(snapshot()).isEqualTo(before);
    }

    private void history(String groupCode, String code, String action, String field, String before,
        String after, Long actor) {
        jdbc.update("""
            INSERT INTO si_cost.cm_code_history
                (group_code, code, action, field_name, before_value, after_value, changed_by, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, TIMESTAMP '9998-01-01 10:00:00')
            """, groupCode, code, action, field, before, after, actor);
    }

    private Map<String, String> snapshot() {
        var result = new LinkedHashMap<String, String>();
        Map<String, String> tables = Map.of(
            "public.sys_menu", "menu_id",
            "public.fin_month_close", "close_month",
            "si_cost.sys_role", "role_id",
            "si_cost.sys_role_menu_perm", "role_id, menu_id",
            "si_cost.cm_code_group", "group_code",
            "si_cost.cm_code", "group_code, code",
            "si_cost.cm_param", "param_key, effective_from",
            "si_cost.cm_excel_mapping", "mapping_id",
            "si_cost.cm_code_history", "hist_id"
        );
        tables.forEach((table, order) -> result.put(table, jdbc.queryForObject(
            "SELECT COALESCE(json_agg(t ORDER BY " + order + ")::text, '[]') FROM " + table + " t", String.class)));
        return result;
    }
}
