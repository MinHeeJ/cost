package cost.apiops;

import cost.common.ApiExceptionHandler;
import cost.common.PermissionService;
import cost.common.RequestIdFilter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.Map;
import org.apache.ibatis.session.SqlSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 이미 Flyway로 준비된 전용 PostgreSQL DB에서 실제 XML과 조회 불변성을 검증한다.
 * Fixture는 연결 transaction 안에만 쓰며 종료 시 rollback한다. migration 재실행은 하지 않는다.
 * 이 standalone 시험은 Spring transaction 프록시 검증이 아니다.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
@EnabledIfEnvironmentVariable(named = "TEST_DB_ISOLATED", matches = "true")
class PublicReferencePostgresTest {
    Connection db;
    SqlSession session;
    MockMvc mvc;

    @BeforeEach
    void useRealXmlInRollbackOnlyFixtureTransaction() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        String user = System.getenv().getOrDefault("TEST_DB_USERNAME", "cost");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        db = DriverManager.getConnection(url, user, password);
        db.setAutoCommit(false);
        var factory = new SqlSessionFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(url, user, password));
        factory.setMapperLocations(new PathMatchingResourcePatternResolver()
            .getResources("classpath:mappers/PublicReferenceMapper.xml"));
        session = factory.getObject().openSession(db);
        var adapter = new PublicReferenceAdapter(session.getMapper(PublicReferenceMapper.class));
        var controller = new PublicReferenceController(new PublicReferenceService(adapter, new PermissionService()));
        mvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new ApiExceptionHandler()).addFilters(new RequestIdFilter()).build();
    }

    @AfterEach
    void rollbackFixtures() throws Exception {
        if (session != null) {
            session.rollback(true);
            session.close();
        }
        if (db != null && !db.isClosed()) {
            db.rollback();
            db.close();
        }
    }

    @Test
    void codesFilterInactiveOrderNewRowsPreserveNullsAndAllTables() throws Exception {
        db.createStatement().execute("""
            UPDATE si_cost.cm_code
            SET use_yn = 'N'
            WHERE group_code = 'JOB' AND code = 'OPS'
            """);
        db.createStatement().execute("""
            INSERT INTO si_cost.cm_code (group_code, code, code_name, sort_order, attr1)
            VALUES ('JOB', 'REFERENCE_TEST', '시험 직무', -1, '250000')
            """);
        Map<String, String> before = snapshot();
        mvc.perform(get("/api/codes/{group}", "JOB"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].code").value("REFERENCE_TEST"))
            .andExpect(jsonPath("$.data[0].attr1").value("250000"))
            .andExpect(jsonPath("$.data[0].attr2").isEmpty())
            .andExpect(jsonPath("$.data[*].code", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("OPS"))));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void paramSelectsLatestEligibleSourceNotFutureAndDoesNotWrite() throws Exception {
        db.createStatement().execute("""
            INSERT INTO si_cost.cm_param
                (param_key, effective_from, param_name, num_value, unit, used_in)
            VALUES ('VAT_RATE', '2026-11', '미래 부가세율', 11, '%', '시험 계약')
            ON CONFLICT (param_key, effective_from)
            DO UPDATE SET num_value = 11, param_name = '미래 부가세율', used_in = '시험 계약'
            """);
        Map<String, String> before = snapshot();
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "2026-10"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(10))
            .andExpect(jsonPath("$.data.effective_from").value("2000-01"));
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "2026-11"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(11))
            .andExpect(jsonPath("$.data.param_name").value("미래 부가세율"))
            .andExpect(jsonPath("$.data.effective_from").value("2026-11"))
            .andExpect(jsonPath("$.data.text_value").isEmpty())
            .andExpect(jsonPath("$.data.unit").value("%"))
            .andExpect(jsonPath("$.data.used_in").value("시험 계약"));
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "1999-12"))
            .andExpect(status().isNotFound());
        assertThat(snapshot()).isEqualTo(before);
    }

    Map<String, String> snapshot() throws Exception {
        Map<String, String> result = new LinkedHashMap<>();
        for (String table : new String[] {"public.sys_menu", "public.fin_month_close", "si_cost.cm_code_group",
            "si_cost.cm_code", "si_cost.cm_code_history", "si_cost.cm_param", "si_cost.cm_excel_mapping",
            "si_cost.sys_role", "si_cost.sys_role_menu_perm"}) {
            String sql = "SELECT COALESCE(jsonb_agg(v ORDER BY v::text)::text, '[]') "
                + "FROM (SELECT to_jsonb(t) AS v FROM " + table + " t) s";
            try (var query = db.createStatement(); var rows = query.executeQuery(sql)) {
                rows.next();
                result.put(table, rows.getString(1));
            }
        }
        return result;
    }
}
