package cost.shared.menu;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 활성 부모 아래의 활성 화면만 조립하는 공개 읽기 서비스. */
@Service
public class MenuService {
    private final MenuReadAdapter adapter;

    public MenuService(MenuReadAdapter adapter) {
        this.adapter = adapter;
    }

    /** 한 readOnly transaction에서 정렬·트리 조립까지 수행하고 고아를 승격하지 않는다. */
    @Transactional(readOnly = true)
    public List<MenuNode> getMenus() {
        List<MenuRow> rows = new ArrayList<>(adapter.read());
        rows.sort(Comparator.comparing(MenuRow::getSortOrder).thenComparing(MenuRow::getMenuId));
        Map<Long, MenuNode> roots = new LinkedHashMap<>();
        for (MenuRow row : rows) {
            if ("Y".equals(row.getUseYn()) && row.getParentMenuId() == null && row.getScreenId() == null) {
                roots.put(row.getMenuId(), new MenuNode(row));
            }
        }
        for (MenuRow row : rows) {
            MenuNode parent = roots.get(row.getParentMenuId());
            if (parent != null && "Y".equals(row.getUseYn()) && row.getScreenId() != null) {
                parent.getChildren().add(new MenuNode(row));
            }
        }
        return new ArrayList<>(roots.values());
    }
}
