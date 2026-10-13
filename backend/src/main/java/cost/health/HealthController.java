package cost.health;

import cost.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 공개 기동 확인 전용 endpoint; 업무 데이터 접근이나 수정은 수행하지 않는다. */
@RestController
public class HealthController {
    /** 인증 없이 공통 성공 envelope만 반환한다. */
    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth() {
        return ApiResponse.empty();
    }
}
