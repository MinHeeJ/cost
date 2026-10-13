package cost.shared.menu;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

/** 감사 필드를 제외하고 BIGINT 식별자를 십진 문자열로 노출하는 메뉴 트리. */
public class MenuNode {
    private final MenuRow row;
    private final List<MenuNode> children = new ArrayList<>();

    public MenuNode(MenuRow row) {
        this.row = row;
    }

    @JsonProperty("menu_id")
    public String getMenuId() {
        return row.getMenuId().toString();
    }

    @JsonProperty("parent_menu_id")
    public String getParentMenuId() {
        return row.getParentMenuId() == null ? null : row.getParentMenuId().toString();
    }

    @JsonProperty("menu_name")
    public String getMenuName() {
        return row.getMenuName();
    }

    @JsonProperty("screen_id")
    public String getScreenId() {
        return row.getScreenId();
    }

    public String getIcon() {
        return row.getIcon();
    }

    @JsonProperty("sort_order")
    public Integer getSortOrder() {
        return row.getSortOrder();
    }

    @JsonProperty("use_yn")
    public String getUseYn() {
        return row.getUseYn();
    }

    @JsonProperty("mobile_yn")
    public String getMobileYn() {
        return "Y".equals(row.getMobileYn()) ? "Y" : "N";
    }

    public List<MenuNode> getChildren() {
        return children;
    }
}
