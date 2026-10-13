package cost.shared.menu;

/** 기존 기반 테이블 SELECT 결과를 XML resultMap으로 수용하는 행 모델. */
public class MenuRow {
    private Long menuId;
    private Long parentMenuId;
    private String menuName;
    private String screenId;
    private String icon;
    private Integer sortOrder;
    private String useYn;
    private String mobileYn;

    public Long getMenuId() {
        return menuId;
    }

    public void setMenuId(Long value) {
        this.menuId = value;
    }

    public Long getParentMenuId() {
        return parentMenuId;
    }

    public void setParentMenuId(Long value) {
        this.parentMenuId = value;
    }

    public String getMenuName() {
        return menuName;
    }

    public void setMenuName(String value) {
        this.menuName = value;
    }

    public String getScreenId() {
        return screenId;
    }

    public void setScreenId(String value) {
        this.screenId = value;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String value) {
        this.icon = value;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer value) {
        this.sortOrder = value;
    }

    public String getUseYn() {
        return useYn;
    }

    public void setUseYn(String value) {
        this.useYn = value;
    }

    public String getMobileYn() {
        return mobileYn;
    }

    public void setMobileYn(String value) {
        this.mobileYn = value;
    }
}
