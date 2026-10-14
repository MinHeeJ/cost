package cost.apiops;

import cost.common.ApiException;
import cost.common.DataScope;
import cost.common.PermissionService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 활성 선택 목록 및 지정월 기준값을 저장 상태 변경 없이 제공한다. */
@Service
public class PublicReferenceService {
    private final PublicReferenceAdapter adapter;
    private final PermissionService permissions;

    public PublicReferenceService(PublicReferenceAdapter adapter, PermissionService permissions) {
        this.adapter = adapter;
        this.permissions = permissions;
    }

    /** 전체 범위를 명시하고 중지 코드는 선택 목록에서만 제외한다. */
    @Transactional(readOnly = true)
    public List<CodeOption> getCodes(String group, DataScope scope) {
        permissions.can("UI-27.read");
        if (group == null || group.length() > 30 || !group.matches("[A-Z_]+")) {
            throw new ApiException(400, "그룹 형식을 확인해 주세요.", "group");
        }
        if (!adapter.groupExists(group)) {
            throw new ApiException(404, "그룹이 없습니다.", null);
        }
        return adapter.codes(group);
    }

    /** 지정월 이하 최신행만 반환하며 미래행이나 누락 행을 생성하지 않는다. */
    @Transactional(readOnly = true)
    public ParamItem getParam(String key, String month) {
        permissions.can("UI-27.read");
        if (month == null || !month.matches("[0-9]{4}-(0[1-9]|1[0-2])")) {
            throw new ApiException(400, "연월을 확인해 주세요.", "month");
        }
        ParamItem result = adapter.param(key, month);
        if (result == null) {
            throw new ApiException(404, "적용 기준값이 없습니다.", null);
        }
        return result;
    }
}
