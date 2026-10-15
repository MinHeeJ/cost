package cost.menus;

import cost.common.DataScope;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** runner가 명시한 격리 DB에서 정상 Boot/Flyway와 실제 Spring 트랜잭션 롤백을 확인한다. */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
@EnabledIfEnvironmentVariable(named = "MENU_TEST_DATABASE_ISOLATED", matches = "true")
class MenuTransactionPostgresTest {
    @Autowired AdminMenuService service;
    @Autowired JdbcTemplate jdbc;
    @SpyBean AdminMenuMapper mapper;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> System.getenv("TEST_DB_URL"));
        properties.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "cost"));
        properties.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
    }

    private String snapshot(String table, String order) {
        return jdbc.queryForObject(
            "SELECT COALESCE(json_agg(t ORDER BY " + order + ")::text, '[]') FROM " + table + " t",
            String.class
        );
    }

    private MenuTreeWriteNode write(AdminMenuNode node) {
        MenuTreeWriteNode input = new MenuTreeWriteNode();
        input.setMenuId(node.getMenuId());
        input.setParentMenuId(node.getParentMenuId());
        input.setMenuName(node.getMenuName());
        input.setSortOrder(node.getSortOrder());
        input.setUseYn(node.getUseYn());
        input.setMobileYn(node.getMobileYn());
        input.setChildren(node.getChildren().stream().map(this::write).toList());
        return input;
    }

    @Test
    void readDoesNotChangeMenuPermissionOrHistorySnapshot() {
        String menus = snapshot("public.sys_menu", "menu_id");
        String permissions = snapshot("si_cost.sys_role_menu_perm", "role_id, menu_id");
        String history = snapshot("si_cost.cm_code_history", "hist_id");
        assertThat(service.getAdminMenus(DataScope.ALL)).isNotEmpty();
        assertThat(snapshot("public.sys_menu", "menu_id")).isEqualTo(menus);
        assertThat(snapshot("si_cost.sys_role_menu_perm", "role_id, menu_id")).isEqualTo(permissions);
        assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(history);
    }

    @Test
    void lastUpdateFailureRollsBackEarlierMenuWrites() {
        List<MenuTreeWriteNode> input = service.getAdminMenus(DataScope.ALL).stream().map(this::write).toList();
        input.get(0).setMenuName("롤백 시험");
        String before = snapshot("public.sys_menu", "menu_id");
        int count = jdbc.queryForObject("SELECT COUNT(*) FROM public.sys_menu", Integer.class);
        int[] updates = {0};
        doAnswer(call -> {
            if (++updates[0] == count) {
                throw new IllegalStateException("late write failure");
            }
            return call.callRealMethod();
        }).when(mapper).update(any());
        try {
            assertThatThrownBy(() -> service.updateAdminMenus(input)).isInstanceOf(IllegalStateException.class);
            assertThat(updates[0]).isEqualTo(count);
            assertThat(snapshot("public.sys_menu", "menu_id")).isEqualTo(before);
        } finally {
            reset(mapper);
        }
    }

    @Test
    void screenPermissionFailureRollsBackMenuInsert() {
        Long parent = jdbc.queryForObject(
            "SELECT MIN(menu_id) FROM public.sys_menu WHERE parent_menu_id IS NULL", Long.class
        );
        String before = snapshot("public.sys_menu", "menu_id");
        String permissions = snapshot("si_cost.sys_role_menu_perm", "role_id, menu_id");
        doThrow(new IllegalStateException("permission failure")).when(mapper).insertScreenPermissions(any());
        try {
            assertThatThrownBy(() -> service.insertScreen(parent, "UI-99", "롤백 화면"))
                .isInstanceOf(IllegalStateException.class);
            assertThat(snapshot("public.sys_menu", "menu_id")).isEqualTo(before);
            assertThat(snapshot("si_cost.sys_role_menu_perm", "role_id, menu_id")).isEqualTo(permissions);
        } finally {
            reset(mapper);
        }
    }

    @Test
    void screenInsertCreatesSevenDeniedPermissionsForEveryExistingRole() {
        Long parent = jdbc.queryForObject(
            "SELECT MIN(menu_id) FROM public.sys_menu WHERE parent_menu_id IS NULL", Long.class
        );
        String history = snapshot("si_cost.cm_code_history", "hist_id");
        AdminMenuNode added = service.insertScreen(parent, "UI-99", "내부 시험 화면");
        try {
            int roles = jdbc.queryForObject("SELECT COUNT(*) FROM si_cost.sys_role", Integer.class);
            assertThat(jdbc.queryForObject("""
                SELECT COUNT(*)
                FROM si_cost.sys_role_menu_perm
                WHERE menu_id = ?
                    AND can_read = 'N' AND can_create = 'N' AND can_update = 'N'
                    AND can_delete = 'N' AND can_upload = 'N' AND can_download = 'N' AND can_confirm = 'N'
                """, Integer.class, Long.valueOf(added.getMenuId()))).isEqualTo(roles);
            assertThat(snapshot("si_cost.cm_code_history", "hist_id")).isEqualTo(history);
        } finally {
            jdbc.update("DELETE FROM public.sys_menu WHERE menu_id = ?", Long.valueOf(added.getMenuId()));
        }
    }
}
