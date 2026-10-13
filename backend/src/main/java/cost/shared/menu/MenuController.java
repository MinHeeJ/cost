package cost.shared.menu;

import cost.common.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 인증 없이 기반 자료를 읽는 승인 API의 transport 경계. */
@RestController
public class MenuController {
    private final MenuService service;

    public MenuController(MenuService service) {
        this.service = service;
    }

    /** 단일 envelope로 읽기 결과를 반환하며 별도의 쓰기 작업은 수행하지 않는다. */
    @GetMapping("/api/menus")
    public ApiResponse<List<MenuNode>> getMenus() {
        return ApiResponse.of(service.getMenus());
    }
}
