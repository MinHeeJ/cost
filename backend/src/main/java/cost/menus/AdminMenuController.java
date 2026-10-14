package cost.menus;

import cost.common.ApiResponse;
import cost.common.DataScope;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 없는 UI-25 관리 API를 공통 성공·오류 envelope로 제공한다. */
@RestController
@RequestMapping("/api/admin/menus")
public class AdminMenuController {
    private final AdminMenuService service;

    public AdminMenuController(AdminMenuService service) {
        this.service = service;
    }

    /** 비활성과 빈 묶음도 편집할 수 있는 전체 관리 트리. */
    @GetMapping
    public ApiResponse<List<AdminMenuNode>> getAdminMenus() {
        return ApiResponse.of(service.getAdminMenus(DataScope.ALL));
    }

    /** 전체 집합 검증과 필수 메뉴 보호를 거쳐 트리를 원자 저장한다. */
    @PutMapping
    public ApiResponse<List<AdminMenuNode>> updateAdminMenus(@RequestBody List<MenuTreeWriteNode> nodes) {
        return ApiResponse.of(service.updateAdminMenus(nodes));
    }

    /** 화면이나 권한 행 없이 마지막 순서의 묶음만 추가한다. */
    @PostMapping("/groups")
    public ApiResponse<AdminMenuNode> createMenuGroup(@RequestBody CreateMenuGroupRequest request) {
        return ApiResponse.of(service.createMenuGroup(request));
    }
}
