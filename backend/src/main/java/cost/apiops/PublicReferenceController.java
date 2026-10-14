package cost.apiops;

import cost.common.ApiResponse;
import cost.common.DataScope;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 인증 없는 UI-27.read 공개 조회를 기존 단일 envelope에 연결한다. */
@RestController
public class PublicReferenceController {
    private final PublicReferenceService service;

    public PublicReferenceController(PublicReferenceService service) {
        this.service = service;
    }

    @GetMapping("/api/codes/{group}")
    public ApiResponse<List<CodeOption>> getCodes(@PathVariable String group) {
        return ApiResponse.of(service.getCodes(group, DataScope.ALL));
    }

    @GetMapping("/api/params/{key}")
    public ApiResponse<ParamItem> getParam(@PathVariable String key, @RequestParam String month) {
        return ApiResponse.of(service.getParam(key, month));
    }
}
