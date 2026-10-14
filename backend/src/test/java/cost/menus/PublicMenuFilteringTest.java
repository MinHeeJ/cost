package cost.menus;

import cost.shared.menu.MenuReadAdapter;
import cost.shared.menu.MenuRow;
import cost.shared.menu.MenuService;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PublicMenuFilteringTest {
    private MenuRow row(long id, Long parent, String screen, String use, String mobile) {
        MenuRow row = new MenuRow();
        row.setMenuId(id);
        row.setParentMenuId(parent);
        row.setScreenId(screen);
        row.setMenuName("메뉴 " + id);
        row.setSortOrder(1);
        row.setUseYn(use);
        row.setMobileYn(mobile);
        return row;
    }

    @Test
    void emptyActiveGroupsAndDisabledScreensAreExcludedWithoutWrites() {
        MenuReadAdapter adapter = mock(MenuReadAdapter.class);
        when(adapter.read()).thenReturn(List.of(
            row(1, null, null, "Y", "Y"), row(2, null, null, "Y", "Y"),
            row(3, null, null, "N", "Y"), row(11, 1L, "UI-12", "Y", "N"),
            row(12, 1L, "UI-33", "N", "Y"), row(13, 3L, "UI-99", "Y", "Y")
        ));
        var result = new MenuService(adapter).getMenus();
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getChildren()).hasSize(1);
        assertThat(result.get(0).getChildren().get(0).getScreenId()).isEqualTo("UI-12");
        assertThat(result.get(0).getChildren().get(0).getMobileYn()).isEqualTo("N");
        verify(adapter).read();
        verifyNoMoreInteractions(adapter);
    }
}
