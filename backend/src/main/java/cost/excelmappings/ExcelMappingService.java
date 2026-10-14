package cost.excelmappings;

import com.fasterxml.jackson.databind.JsonNode;
import cost.common.ApiException;
import cost.common.CodeHistoryWriter;
import cost.common.CurrentUser;
import cost.common.DataScope;
import cost.common.PermissionService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 공개 대응 관리의 검증·잠금·저장·항목별 이력을 단일 트랜잭션으로 묶는다. */
@Service
public class ExcelMappingService {
    private final ExcelMappingAdapter adapter;
    private final CodeHistoryWriter history;
    private final CurrentUser user;
    private final PermissionService permissions;

    public ExcelMappingService(
        ExcelMappingAdapter adapter,
        CodeHistoryWriter history,
        CurrentUser user,
        PermissionService permissions
    ) {
        this.adapter = adapter;
        this.history = history;
        this.user = user;
        this.permissions = permissions;
    }

    /** 중지된 참조 코드도 이름을 유지하며 조회 중 저장·이력을 보정하지 않는다. */
    @Transactional(readOnly = true)
    public List<ExcelMapping> getExcelMappings(DataScope scope) {
        permit("UI-27.read");
        java.util.Objects.requireNonNull(scope);
        return adapter.read();
    }

    /** 동일 코드 잠금 뒤 업무 삼중키를 검사하여 새 대응과 ADD 이력을 함께 저장한다. */
    @Transactional
    public ExcelMapping createExcelMapping(CreateExcelMappingRequest input) {
        permit("UI-27.create");
        if (input == null) {
            throw bad("body");
        }
        ExcelMapping row = new ExcelMapping();
        row.setExcelLabel(text(input.excelLabel, "excel_label", 100, false));
        row.setTargetGroup(text(input.targetGroup, "target_group", 30, false));
        row.setTargetCode(text(input.targetCode, "target_code", 30, false));
        row.setMapRole(role(input.mapRole));
        row.setNote(input.note == null ? null : text(input.note, "note", 200, true));
        row.setUseYn("Y");
        if (!adapter.lockCode(row.getTargetGroup(), row.getTargetCode())) {
            throw missing();
        }
        if (adapter.find(row.getExcelLabel(), row.getTargetGroup(), row.getTargetCode()) != null) {
            throw ApiException.conflict("DUPLICATE_CODE");
        }
        try {
            adapter.insert(row, user.getUserId());
        } catch (DuplicateKeyException error) {
            throw ApiException.conflict("DUPLICATE_CODE");
        }
        history.recordChanges(row.getTargetGroup(), row.getTargetCode(), null, values(row));
        return adapter.find(row.getExcelLabel(), row.getTargetGroup(), row.getTargetCode());
    }

    /** 삼중키는 query에서만 받고 누락 필드는 보존, 명시 NULL 메모는 지운다. */
    @Transactional
    public ExcelMapping updateExcelMapping(
        String label,
        String group,
        String code,
        UpdateExcelMappingRequest input
    ) {
        permit("UI-27.update");
        key(label, "excel_label", 100);
        key(group, "target_group", 30);
        key(code, "target_code", 30);
        if (input == null || (input.mapRole == null && input.note == null && input.useYn == null)) {
            throw bad("body");
        }
        String role = input.mapRole == null ? null : role(input.mapRole);
        String note = input.note == null ? null : text(input.note, "note", 200, true);
        String active = input.useYn == null ? null : flag(input.useYn);
        if (!adapter.lockMapping(label, group, code)) {
            throw missing();
        }
        ExcelMapping row = adapter.find(label, group, code);
        Map<String, Object> before = values(row);
        if (input.mapRole != null) {
            row.setMapRole(role);
        }
        if (input.note != null) {
            row.setNote(note);
        }
        if (input.useYn != null) {
            row.setUseYn(active);
        }
        Map<String, Object> after = values(row);
        if (!before.equals(after)) {
            adapter.update(row);
            history.recordChanges(group, code, before, after);
        }
        return row;
    }

    private Map<String, Object> values(ExcelMapping row) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("excel_label", row.getExcelLabel());
        values.put("target_group", row.getTargetGroup());
        values.put("target_code", row.getTargetCode());
        values.put("map_role", row.getMapRole());
        values.put("note", row.getNote());
        values.put("use_yn", row.getUseYn());
        return values;
    }

    private String role(JsonNode value) {
        String role = text(value, "map_role", 10, false);
        if (!"MAIN".equals(role) && !"SUB".equals(role)) {
            throw bad("map_role");
        }
        return role;
    }

    private String flag(JsonNode value) {
        String flag = text(value, "use_yn", 1, false);
        if (!"Y".equals(flag) && !"N".equals(flag)) {
            throw bad("use_yn");
        }
        return flag;
    }

    private String text(JsonNode value, String field, int limit, boolean nullable) {
        if (value != null && value.isNull() && nullable) {
            return null;
        }
        if (value == null || !value.isTextual()) {
            throw bad(field);
        }
        String result = value.textValue();
        if ((!nullable && result.isBlank()) || result.codePointCount(0, result.length()) > limit) {
            throw bad(field);
        }
        return result;
    }

    private void key(String value, String field, int limit) {
        if (value == null || value.isBlank() || value.codePointCount(0, value.length()) > limit) {
            throw bad(field);
        }
    }

    private void permit(String key) {
        if (!permissions.can(key)) {
            throw new ApiException(403, "허용되지 않은 기능입니다.", null);
        }
    }

    private ApiException bad(String field) {
        return new ApiException(400, "입력값을 확인해 주세요.", field);
    }

    private ApiException missing() {
        return new ApiException(404, "대응 또는 코드가 없습니다.", null);
    }
}
