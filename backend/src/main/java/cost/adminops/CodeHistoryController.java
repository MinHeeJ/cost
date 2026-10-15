package cost.adminops;

import cost.common.ApiException;
import cost.common.ApiResponse;
import cost.common.DataScope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** UI-27 변경 이력의 공개 transport 경계. 기본값과 wire 오류 필드를 유지한다. */
@RestController
public class CodeHistoryController {
    private final CodeHistoryService service;

    public CodeHistoryController(CodeHistoryService service) {
        this.service = service;
    }

    /** 알려지지 않은 group은 빈 페이지이며 조회에서 이력이나 관련 자산을 생성하지 않는다. */
    @GetMapping("/api/admin/code-history")
    public ApiResponse<CodeHistoryPage> getCodeHistory(
        @RequestParam(required = false) String group,
        @RequestParam(required = false) String page,
        @RequestParam(required = false) String size
    ) {
        return ApiResponse.of(service.getCodeHistory(
            group, integer(page, 1, "page"), integer(size, 50, "size"), DataScope.ALL
        ));
    }

    private int integer(String value, int fallback, String field) {
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException error) {
            throw new ApiException(400, "정수를 입력해 주세요.", field);
        }
    }
}
