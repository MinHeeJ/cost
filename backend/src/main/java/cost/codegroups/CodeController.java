package cost.codegroups;

import cost.common.ApiResponse;
import cost.common.DataScope;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 인증 없는 UI-27 관리 요청을 서비스와 단일 응답 envelope로 연결한다. */
@RestController
public class CodeController {
    private final CodeService service;

    public CodeController(CodeService service) {
        this.service = service;
    }

    /** UI-27.read, 현재 전체 데이터 범위. */
    @GetMapping("/api/admin/code-groups")
    public ApiResponse<List<CodeGroup>> getCodeGroups() {
        return ApiResponse.of(service.getCodeGroups(DataScope.ALL));
    }

    /** UI-27.read, 사용 중지 코드도 반환한다. */
    @GetMapping("/api/admin/code-groups/{group}/codes")
    public ApiResponse<List<AdminCode>> getGroupCodes(@PathVariable String group) {
        return ApiResponse.of(service.getGroupCodes(group, DataScope.ALL));
    }

    /** UI-27.create, BIZ 그룹만 생성한다. */
    @PostMapping("/api/admin/code-groups")
    public ApiResponse<CodeGroup> createCodeGroup(@RequestBody CreateCodeGroupRequest request) {
        return ApiResponse.of(service.createCodeGroup(request));
    }

    /** UI-27.update, 전체 집합을 검증한 뒤 코드와 이력을 함께 저장한다. */
    @PutMapping("/api/admin/code-groups/{group}/codes")
    public ApiResponse<List<AdminCode>> updateGroupCodes(
        @PathVariable String group,
        @RequestBody List<CodeWriteItem> request
    ) {
        return ApiResponse.of(service.updateGroupCodes(group, request));
    }
}
