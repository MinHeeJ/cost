package cost.shared;

import cost.common.ApiExceptionHandler;
import cost.common.RequestIdFilter;
import cost.health.HealthController;
import cost.shared.menu.*;
import cost.shared.monthclose.*;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.UUID;
import org.apache.ibatis.session.SqlSession;
import org.flywaydb.core.Flyway;
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

/** 실 PostgreSQL에서 XML materialization과 읽기 전후 모든 저장 필드 불변성을 검증한다. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class ReadApiPostgresTest {
    Connection db;
    String schema;
    SqlSession session;
    MockMvc mvc;

    @BeforeEach
    void migrateAndUseRealXmlMappers() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        String user = System.getenv().getOrDefault("TEST_DB_USERNAME", "cost");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        db = DriverManager.getConnection(url, user, password);
        assertThat(db.getMetaData().getDatabaseMajorVersion()).isEqualTo(16);
        schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
            .locations("classpath:db/migration").load().migrate();
        db.createStatement().execute("SET search_path TO " + schema);
        String scopedUrl = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        var factory = new SqlSessionFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(scopedUrl, user, password));
        factory.setMapperLocations(new PathMatchingResourcePatternResolver()
            .getResources("classpath:mappers/*Mapper.xml"));
        session = factory.getObject().openSession();
        var menus = new MenuController(new MenuService(new MenuReadAdapter(session.getMapper(MenuMapper.class))));
        var months = new MonthCloseController(new MonthCloseService(
            new MonthCloseReadAdapter(session.getMapper(MonthCloseMapper.class))));
        mvc = MockMvcBuilders.standaloneSetup(menus, months, new HealthController())
            .setControllerAdvice(new ApiExceptionHandler()).addFilters(new RequestIdFilter()).build();
    }

    @AfterEach
    void cleanup() throws Exception {
        if (session != null) session.close();
        if (db != null) {
            if (schema != null) db.createStatement().execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            db.close();
        }
    }

    @Test
    void fullSeedTreeContainsTenGroupsThirtyOneScreensAndPcOnlyRows() throws Exception {
        String before = snapshot("sys_menu", "menu_id");
        var result = mvc.perform(get("/api/menus"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(10)).andReturn();
        var data = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.getResponse().getContentAsString()).get("data");
        int screens = 0;
        for (var root : data) {
            assertThat(root.get("menu_id").isTextual()).isTrue();
            int last = 0;
            for (var child : root.get("children")) {
                screens++;
                assertThat(child.get("sort_order").asInt()).isGreaterThanOrEqualTo(last);
                last = child.get("sort_order").asInt();
                if ("UI-14".equals(child.get("screen_id").asText())) {
                    assertThat(child.get("mobile_yn").asText()).isEqualTo("N");
                }
            }
        }
        assertThat(screens).isEqualTo(31);
        assertThat(snapshot("sys_menu", "menu_id")).isEqualTo(before);
    }

    @Test
    void inactiveFixtureAndChildrenOfInactiveParentRemainStoredButAreNotPublic() throws Exception {
        db.createStatement().execute("UPDATE sys_menu SET use_yn = 'N' WHERE menu_id IN (2, 24)");
        String before = snapshot("sys_menu", "menu_id");
        mvc.perform(get("/api/menus"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(9))
            .andExpect(jsonPath("$.data[*].children[*].screen_id",
                org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItems("UI-03", "UI-15", "UI-02"))));
        assertThat(snapshot("sys_menu", "menu_id")).isEqualTo(before);
    }

    @Test
    void closedOpenAndMissingMonthReadPreservesEveryAuditFieldAndRowCount() throws Exception {
        String before = snapshot("fin_month_close", "close_month");
        mvc.perform(get("/api/month-close").param("from", "2026-09").param("to", "2026-11"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].status").value("CLOSED"))
            .andExpect(jsonPath("$.data[1].status").value("OPEN"))
            .andExpect(jsonPath("$.data[2].status").value("OPEN"));
        assertThat(snapshot("fin_month_close", "close_month")).isEqualTo(before);
        assertThat(scalar("SELECT COUNT(*) FROM fin_month_close WHERE close_month = '2026-11'"))
            .isEqualTo("0");
    }

    @Test
    void healthLeavesBothTableSnapshotsUnchanged() throws Exception {
        String menus = snapshot("sys_menu", "menu_id");
        String months = snapshot("fin_month_close", "close_month");
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(header().exists("X-Request-Id"));
        assertThat(snapshot("sys_menu", "menu_id")).isEqualTo(menus);
        assertThat(snapshot("fin_month_close", "close_month")).isEqualTo(months);
    }

    String snapshot(String table, String order) throws Exception {
        return scalar("SELECT json_agg(t ORDER BY t." + order + ")::text FROM " + table + " t");
    }

    String scalar(String sql) throws Exception {
        try (var statement = db.createStatement(); var result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }
}
