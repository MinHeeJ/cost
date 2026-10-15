package cost.menus;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

/** 감사 정보와 정밀도 손실 없는 문자열 ID를 포함한 관리 트리. */
public class AdminMenuNode {
    private final AdminMenuRow row;
    private final List<AdminMenuNode> children = new ArrayList<>();

    public AdminMenuNode(AdminMenuRow row) {
        this.row = row;
    }

    @JsonProperty("menu_id")
    public String getMenuId() {
        return row.getMenuId() == null ? null : row.getMenuId().toString();
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

    @JsonProperty("icon")
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
        return row.getMobileYn();
    }

    @JsonProperty("updated_at")
    public java.time.LocalDateTime getUpdatedAt() {
        return row.getUpdatedAt();
    }

    @JsonProperty("updated_by")
    public String getUpdatedBy() {
        return row.getUpdatedBy() == null ? null : row.getUpdatedBy().toString();
    }

    public List<AdminMenuNode> getChildren() {
        return children;
    }
}
