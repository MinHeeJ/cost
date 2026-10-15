package cost.common;

import java.util.List;
import org.springframework.stereotype.Service;

/** 로그인 없이 사용하는 현재 주체 정책. NULL 감사 ID는 사용자 DB를 조회하지 않는다. */
@Service
public class CurrentUser {
    public Long getUserId() {
        return null;
    }

    public String getName() {
        return "기본 사용자";
    }

    public List<Long> getRoleIds() {
        return List.of(1L);
    }
}
