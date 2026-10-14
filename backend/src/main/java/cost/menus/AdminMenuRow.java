package cost.menus;

/** sys_menu 조회·쓰기와 생성 키를 전달하는 영속성 행. */
public class AdminMenuRow {
    private Long menuId;
    private Long parentMenuId;
    private String menuName;
    private String screenId;
    private String icon;
    private Integer sortOrder;
    private String useYn;
    private String mobileYn;
    private java.time.LocalDateTime updatedAt;
    private Long updatedBy;

    public Long getMenuId() {
        return menuId;
    }

    public void setMenuId(Long value) {
        menuId = value;
    }

    public Long getParentMenuId() {
        return parentMenuId;
    }

    public void setParentMenuId(Long value) {
        parentMenuId = value;
    }

    public String getMenuName() {
        return menuName;
    }

    public void setMenuName(String value) {
        menuName = value;
    }

    public String getScreenId() {
        return screenId;
    }

    public void setScreenId(String value) {
        screenId = value;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String value) {
        icon = value;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer value) {
        sortOrder = value;
    }

    public String getUseYn() {
        return useYn;
    }

    public void setUseYn(String value) {
        useYn = value;
    }

    public String getMobileYn() {
        return mobileYn;
    }

    public void setMobileYn(String value) {
        mobileYn = value;
    }

    public java.time.LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(java.time.LocalDateTime value) {
        updatedAt = value;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(Long value) {
        updatedBy = value;
    }
}
