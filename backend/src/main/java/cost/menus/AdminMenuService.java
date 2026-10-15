package cost.menus;

import cost.common.ApiException;
import cost.common.CurrentUser;
import cost.common.DataScope;
import cost.common.PermissionService;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 전체 ID·종류·필수 메뉴 불변식을 검증한 후 원자적으로 메뉴 트리를 저장한다. */
@Service
public class AdminMenuService {
    private static final Set<String> ICONS = Set.of(
        "grid", "db", "folder", "calendar", "receipt", "chart", "wallet", "lock", "sparkle", "gear"
    );
    private final AdminMenuAdapter adapter;
    private final CurrentUser user;
    private final PermissionService permissions;

    public AdminMenuService(AdminMenuAdapter adapter, CurrentUser user, PermissionService permissions) {
        this.adapter = adapter;
        this.user = user;
        this.permissions = permissions;
    }

    /** 사용 여부와 빈 묶음을 필터하지 않는 전체 관리 조회. */
    @Transactional(readOnly = true)
    public List<AdminMenuNode> getAdminMenus(DataScope scope) {
        permissions.can("UI-25.read");
        return tree(adapter.read());
    }

    /** 기존 root를 ID 순으로 잠그고 모든 검증을 끝낸 뒤 같은 트랜잭션에서 갱신한다. */
    @Transactional
    public List<AdminMenuNode> updateAdminMenus(List<MenuTreeWriteNode> nodes) {
        permissions.can("UI-25.update");
        if (nodes == null) {
            throw invalid("body");
        }
        adapter.lockRoots();
        Map<Long, AdminMenuRow> existing = new HashMap<>();
        for (AdminMenuRow row : adapter.read()) {
            existing.put(row.getMenuId(), row);
        }
        Set<Long> seen = new HashSet<>();
        List<AdminMenuRow> writes = new ArrayList<>();
        flatten(nodes, null, existing, seen, writes);
        if (!seen.equals(existing.keySet())) {
            throw invalid("menu_id");
        }
        Map<Long, AdminMenuRow> result = new HashMap<>();
        for (AdminMenuRow row : writes) {
            result.put(row.getMenuId(), row);
        }
        for (AdminMenuRow row : writes) {
            if (required(row.getScreenId())) {
                AdminMenuRow parent = result.get(row.getParentMenuId());
                if (!"Y".equals(row.getUseYn()) || parent == null || !"Y".equals(parent.getUseYn())) {
                    throw ApiException.conflict("MENU_REQUIRED");
                }
            }
        }
        for (AdminMenuRow row : writes) {
            adapter.update(row);
        }
        return tree(adapter.read());
    }

    /** 묶음 생성은 권한 행이나 코드 이력을 만들지 않는다. 생성 키는 INSERT에서 받는다. */
    @Transactional
    public AdminMenuNode createMenuGroup(CreateMenuGroupRequest request) {
        permissions.can("UI-25.create");
        if (request == null) {
            throw invalid("body");
        }
        name(request.getMenuName());
        if (!ICONS.contains(Objects.toString(request.getIcon(), ""))) {
            throw invalid("icon");
        }
        adapter.lockRoots();
        List<AdminMenuRow> rows = adapter.read();
        int order = rows.stream().filter(row -> row.getParentMenuId() == null)
            .mapToInt(AdminMenuRow::getSortOrder).max().orElse(0) + 1;
        AdminMenuRow row = newRow(request.getMenuName(), order);
        row.setIcon(request.getIcon());
        adapter.insert(row);
        return new AdminMenuNode(row);
    }

    /** 외부 화면 등록 API 없이 메뉴와 모든 기존 역할의 N 권한을 함께 생성하는 내부 경계. */
    @Transactional
    public AdminMenuNode insertScreen(Long parentId, String screenId, String menuName) {
        name(menuName);
        if (screenId == null || screenId.isEmpty() || screenId.length() > 10) {
            throw invalid("screen_id");
        }
        adapter.lockRoots();
        List<AdminMenuRow> rows = adapter.read();
        if (rows.stream().noneMatch(row -> Objects.equals(row.getMenuId(), parentId)
            && row.getParentMenuId() == null && row.getScreenId() == null)) {
            throw invalid("parent_menu_id");
        }
        int order = rows.stream().filter(row -> Objects.equals(row.getParentMenuId(), parentId))
            .mapToInt(AdminMenuRow::getSortOrder).max().orElse(0) + 1;
        AdminMenuRow row = newRow(menuName, order);
        row.setParentMenuId(parentId);
        row.setScreenId(screenId);
        adapter.insert(row);
        adapter.insertScreenPermissions(row.getMenuId());
        return new AdminMenuNode(row);
    }

    private void flatten(
        List<MenuTreeWriteNode> nodes,
        Long parent,
        Map<Long, AdminMenuRow> existing,
        Set<Long> seen,
        List<AdminMenuRow> writes
    ) {
        for (int index = 0; index < nodes.size(); index++) {
            MenuTreeWriteNode node = nodes.get(index);
            if (node == null) {
                throw invalid("body");
            }
            Long id = id(node.getMenuId(), "menu_id");
            if (!seen.add(id) || !existing.containsKey(id)) {
                throw invalid("menu_id");
            }
            if (!node.isParentPresent()) {
                throw invalid("parent_menu_id");
            }
            Long declaredParent = node.getParentMenuId() == null ? null
                : id(node.getParentMenuId(), "parent_menu_id");
            if (!Objects.equals(parent, declaredParent)) {
                throw invalid("parent_menu_id");
            }
            AdminMenuRow old = existing.get(id);
            if ((parent == null) != (old.getParentMenuId() == null && old.getScreenId() == null)) {
                throw invalid("parent_menu_id");
            }
            name(node.getMenuName());
            flag(node.getUseYn(), "use_yn");
            flag(node.getMobileYn(), "mobile_yn");
            if (node.getSortOrder() == null || node.getSortOrder() < 1) {
                throw invalid("sort_order");
            }
            if (node.getChildren() == null || (parent != null && !node.getChildren().isEmpty())) {
                throw invalid("children");
            }
            AdminMenuRow row = newRow(node.getMenuName(), index + 1);
            row.setMenuId(id);
            row.setParentMenuId(parent);
            row.setScreenId(old.getScreenId());
            row.setIcon(old.getIcon());
            row.setUseYn(node.getUseYn());
            row.setMobileYn(node.getMobileYn());
            writes.add(row);
            if (parent == null) {
                flatten(node.getChildren(), id, existing, seen, writes);
            }
        }
    }

    private AdminMenuRow newRow(String name, int order) {
        AdminMenuRow row = new AdminMenuRow();
        row.setMenuName(name);
        row.setSortOrder(order);
        row.setUseYn("Y");
        row.setMobileYn("Y");
        row.setUpdatedAt(LocalDateTime.now(ZoneId.of("Asia/Seoul")));
        row.setUpdatedBy(user.getUserId());
        return row;
    }

    private List<AdminMenuNode> tree(List<AdminMenuRow> source) {
        List<AdminMenuRow> rows = new ArrayList<>(source);
        rows.sort(Comparator.comparing(AdminMenuRow::getSortOrder).thenComparing(AdminMenuRow::getMenuId));
        Map<Long, AdminMenuNode> roots = new LinkedHashMap<>();
        for (AdminMenuRow row : rows) {
            if (row.getParentMenuId() == null) {
                roots.put(row.getMenuId(), new AdminMenuNode(row));
            }
        }
        for (AdminMenuRow row : rows) {
            AdminMenuNode parent = roots.get(row.getParentMenuId());
            if (parent != null) {
                parent.getChildren().add(new AdminMenuNode(row));
            }
        }
        return new ArrayList<>(roots.values());
    }

    private boolean required(String screen) {
        return "UI-16".equals(screen) || "UI-25".equals(screen);
    }

    private Long id(String value, String field) {
        if (value == null || !value.matches("^[0-9]+$")) {
            throw invalid(field);
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException error) {
            throw invalid(field);
        }
    }

    private void name(String value) {
        if (value == null || value.isEmpty() || value.codePointCount(0, value.length()) > 50) {
            throw invalid("menu_name");
        }
    }

    private void flag(String value, String field) {
        if (!"Y".equals(value) && !"N".equals(value)) {
            throw invalid(field);
        }
    }

    private ApiException invalid(String field) {
        return new ApiException(400, "메뉴 입력 오류", field);
    }
}
