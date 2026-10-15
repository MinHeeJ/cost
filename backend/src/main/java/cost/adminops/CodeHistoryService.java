package cost.adminops;

import cost.common.ApiException;
import cost.common.DataScope;
import cost.common.PermissionService;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** 공개 이력 탐색의 입력 검증과 동일 snapshot의 목록/건수 조회를 담당한다. */
@Service
public class CodeHistoryService {
    private final CodeHistoryAdapter adapter;
    private final PermissionService permissions;

    public CodeHistoryService(CodeHistoryAdapter adapter, PermissionService permissions) {
        this.adapter = adapter;
        this.permissions = permissions;
    }

    /** ALL 범위·UI-27.read 확장 지점은 현재 비인증 허용이며 저장 상태를 보정하지 않는다. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public CodeHistoryPage getCodeHistory(String group, int page, int size, DataScope scope) {
        Objects.requireNonNull(scope, "scope");
        if (group != null && group.isBlank()) {
            throw new ApiException(400, "그룹을 확인해 주세요.", "group");
        }
        if (page < 1) {
            throw new ApiException(400, "페이지를 확인해 주세요.", "page");
        }
        if (size != 20 && size != 50 && size != 100) {
            throw new ApiException(400, "페이지 크기를 확인해 주세요.", "size");
        }
        // PermissionService는 요구된 고정 허용 정책이다. DB 역할이나 계정을 조회하지 않는다.
        permissions.can("UI-27.read");
        long pageOffset = ((long) page - 1) * size;
        long total = adapter.count(group);
        return new CodeHistoryPage(adapter.read(group, size, pageOffset), total, page, size);
    }
}
