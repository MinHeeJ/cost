package cost.menus;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** 승인된 전체 트리 필드만 수신하며 nullable 부모의 누락도 구분한다. */
public class MenuTreeWriteNode {
    private String menuId;
    private String parentMenuId;
    private String menuName;
    private Integer sortOrder;
    private String useYn;
    private String mobileYn;
    private List<MenuTreeWriteNode> children;
    private boolean parentPresent;

    @JsonProperty("menu_id")
    public String getMenuId() {
        return menuId;
    }

    @JsonProperty("menu_id")
    public void setMenuId(String value) {
        menuId = value;
    }

    @JsonProperty("parent_menu_id")
    public String getParentMenuId() {
        return parentMenuId;
    }

    @JsonProperty("parent_menu_id")
    public void setParentMenuId(String value) {
        parentMenuId = value;
        parentPresent = true;
    }

    @JsonProperty("menu_name")
    public String getMenuName() {
        return menuName;
    }

    @JsonProperty("menu_name")
    public void setMenuName(String value) {
        menuName = value;
    }

    @JsonProperty("sort_order")
    public Integer getSortOrder() {
        return sortOrder;
    }

    @JsonProperty("sort_order")
    public void setSortOrder(Integer value) {
        sortOrder = value;
    }

    @JsonProperty("use_yn")
    public String getUseYn() {
        return useYn;
    }

    @JsonProperty("use_yn")
    public void setUseYn(String value) {
        useYn = value;
    }

    @JsonProperty("mobile_yn")
    public String getMobileYn() {
        return mobileYn;
    }

    @JsonProperty("mobile_yn")
    public void setMobileYn(String value) {
        mobileYn = value;
    }

    @JsonProperty("children")
    public List<MenuTreeWriteNode> getChildren() {
        return children;
    }

    @JsonProperty("children")
    public void setChildren(List<MenuTreeWriteNode> value) {
        children = value;
    }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isParentPresent() {
        return parentPresent;
    }
}
