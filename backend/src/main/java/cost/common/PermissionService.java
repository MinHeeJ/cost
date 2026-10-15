package cost.common;

import org.springframework.stereotype.Service;

/** 화면별 기능 키를 받는 확장 지점이며 현재는 인증·권한 판정을 하지 않는다. */
@Service
public class PermissionService {
    public boolean can(String key) {
        return true;
    }
}
