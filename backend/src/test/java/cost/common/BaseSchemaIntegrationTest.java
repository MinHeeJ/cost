package cost.common;

import cost.health.HealthController;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Gate is evaluated before opening a connection; ordinary container tests are database-free.
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class BaseSchemaIntegrationTest {
    Connection db;
    String schema;
    String url;
    String username;
    String password;

    @BeforeEach
    void migrateIsolatedPostgresSchema() throws Exception {
        url = System.getenv("TEST_DB_URL");
        username = System.getenv().getOrDefault("TEST_DB_USERNAME", "cost");
        password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        db = DriverManager.getConnection(url, username, password);
        assertThat(db.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
        assertThat(db.getMetaData().getDatabaseMajorVersion()).isEqualTo(16);
        schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(url, username, password)
            .schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
        db.createStatement().execute("SET search_path TO " + schema);
    }

    @AfterEach
    void cleanup() throws Exception {
        if (db != null) {
            if (schema != null) {
                db.createStatement().execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
            db.close();
        }
    }

    @Test
    void seedCountsFlagsAuditAndIdentityMatchContract() throws Exception {
        assertThat(scalar("SELECT COUNT(*) FROM sys_menu")).isEqualTo("41");
        assertThat(scalar("SELECT COUNT(screen_id) FROM sys_menu")).isEqualTo("31");
        assertThat(scalar("SELECT COUNT(*) FROM fin_month_close")).isEqualTo("10");
        assertThat(scalar("SELECT COUNT(*) FROM sys_menu WHERE mobile_yn = 'N'" )).isEqualTo("7");
        assertThat(scalar("SELECT COUNT(*) FROM sys_menu WHERE use_yn = 'Y'" )).isEqualTo("41");
        assertThat(scalar("SELECT COUNT(*) FROM sys_menu WHERE created_by IS NOT NULL OR updated_by IS NOT NULL"))
            .isEqualTo("0");
        assertThat(scalar("SELECT COUNT(*) FROM fin_month_close WHERE status = 'CLOSED'" )).isEqualTo("9");
        assertThat(scalar("SELECT status FROM fin_month_close WHERE close_month = '2026-10'" )).isEqualTo("OPEN");
        assertThat(scalar("SELECT COUNT(*) FROM fin_month_close WHERE closed_by IS NOT NULL "
            + "OR reopened_by IS NOT NULL OR reopened_at IS NOT NULL OR reopen_reason IS NOT NULL"))
            .isEqualTo("0");
        assertThat(scalar("SELECT COUNT(*) FROM fin_month_close WHERE status = 'CLOSED' "
            + "AND closed_at = (close_month || '-01')::timestamp + INTERVAL '1 month 4 days'"))
            .isEqualTo("9");
        assertThat(scalar("SELECT COUNT(*) FROM fin_month_close WHERE close_month = '2026-10' "
            + "AND closed_at IS NULL" )).isEqualTo("1");
        assertThat(Long.parseLong(scalar("INSERT INTO sys_menu (menu_name, sort_order) "
            + "VALUES ('시험', 1) RETURNING menu_id"))).isGreaterThan(41);
    }

    @Test
    void selfForeignKeyRejectsUnknownParentAndNoActionDeletion() throws Exception {
        assertRejected("INSERT INTO sys_menu (parent_menu_id, menu_name, sort_order) "
            + "VALUES (999999, '시험', 1)", "23503");
        assertRejected("DELETE FROM sys_menu WHERE menu_id = 1", "23503");
    }

    @Test
    void uniqueScreenAllowsMultipleNullsButRejectsDuplicates() throws Exception {
        db.createStatement().execute("INSERT INTO sys_menu (menu_name, sort_order) VALUES ('가', 1), ('나', 2)");
        assertRejected("INSERT INTO sys_menu (menu_name, screen_id, sort_order) "
            + "VALUES ('중복', 'UI-16', 1)", "23505");
    }

    @Test
    void monthFormatAndStatusRejectInvalidValues() throws Exception {
        assertRejected("INSERT INTO fin_month_close (close_month, status) VALUES ('2027-13', 'OPEN')", "23514");
        assertRejected("INSERT INTO fin_month_close (close_month, status) VALUES ('2027-01', 'OTHER')", "23514");
        assertRejected("INSERT INTO fin_month_close (close_month, status) VALUES ('2026-01', 'OPEN')", "23505");
    }

    @Test
    void flagsAndRequiredMenuFieldsEnforceMinimalConstraints() throws Exception {
        assertRejected("INSERT INTO sys_menu (menu_name, sort_order, use_yn) VALUES ('시험', 1, 'X')", "23514");
        assertRejected("INSERT INTO sys_menu (menu_name, sort_order, mobile_yn) VALUES ('시험', 1, 'X')", "23514");
        assertRejected("INSERT INTO sys_menu (menu_name, sort_order) VALUES (NULL, 1)", "23502");
        assertRejected("INSERT INTO sys_menu (menu_name, sort_order) VALUES ('시험', NULL)", "23502");
        db.createStatement().execute("INSERT INTO fin_month_close (close_month, status) VALUES ('2027-01', NULL)");
    }

    @Test
    void anonymousHealthDoesNotChangeEitherTable() throws Exception {
        String menu = snapshot("sys_menu", "menu_id");
        String months = snapshot("fin_month_close", "close_month");
        var mvc = MockMvcBuilders.standaloneSetup(new HealthController())
            .setControllerAdvice(new ApiExceptionHandler()).addFilters(new RequestIdFilter()).build();
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true))
            .andExpect(header().exists("X-Request-Id"));
        assertThat(snapshot("sys_menu", "menu_id")).isEqualTo(menu);
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

    void assertRejected(String sql, String state) {
        assertThatThrownBy(() -> db.createStatement().execute(sql))
            .isInstanceOf(SQLException.class)
            .extracting(error -> ((SQLException) error).getSQLState()).isEqualTo(state);
    }
}
