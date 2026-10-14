package cost.menus;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 묶음 생성 시 클라이언트가 정할 수 있는 이름과 아이콘만 수신한다. */
public class CreateMenuGroupRequest {
    private String menuName;
    private String icon;

    @JsonProperty("menu_name")
    public String getMenuName() {
        return menuName;
    }

    @JsonProperty("menu_name")
    public void setMenuName(String value) {
        menuName = value;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String value) {
        icon = value;
    }
}
