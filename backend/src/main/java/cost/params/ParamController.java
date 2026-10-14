package cost.params;

import cost.common.ApiResponse;
import cost.common.DataScope;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 인증 없는 기준값 관리 API를 기존 단일 envelope로 제공한다. */
@RestController
public class ParamController {
    private final ParamService service;

    public ParamController(ParamService service) {
        this.service = service;
    }

    @GetMapping("/api/admin/params")
    public ApiResponse<List<ParamItem>> getAdminParams() {
        return ApiResponse.of(service.getAdminParams(DataScope.ALL));
    }

    @GetMapping("/api/admin/params/{key}/history")
    public ApiResponse<List<ParamItem>> getParamHistory(@PathVariable String key) {
        return ApiResponse.of(service.getParamHistory(key, DataScope.ALL));
    }

    @PutMapping("/api/admin/params/{key}")
    public ApiResponse<ParamItem> updateParam(@PathVariable String key, @RequestBody UpdateParamRequest request) {
        return ApiResponse.of(service.updateParam(key, request));
    }
}
