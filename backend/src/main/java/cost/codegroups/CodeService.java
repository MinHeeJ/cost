package cost.codegroups;

import com.fasterxml.jackson.databind.JsonNode;
import cost.common.ApiException;
import cost.common.CodeHistoryWriter;
import cost.common.CurrentUser;
import cost.common.DataScope;
import cost.common.PermissionService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Comparator;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 전체 코드 집합과 SYSTEM 불변식을 검증하고 항목별 이력을 원자적으로 저장한다. */
@Service
public class CodeService {
    private final CodeAdapter adapter;
    private final CodeHistoryWriter history;
    private final CurrentUser user;
    private final PermissionService permission;

    public CodeService(CodeAdapter adapter, CodeHistoryWriter history, CurrentUser user, PermissionService permission) {
        this.adapter = adapter;
        this.history = history;
        this.user = user;
        this.permission = permission;
    }

    /** 현재 ALL 정책으로 중지 그룹과 전체 코드 건수를 함께 읽는다. */
    @Transactional(readOnly = true)
    public List<CodeGroup> getCodeGroups(DataScope scope) {
        permit("read");
        List<CodeGroup> rows = new ArrayList<>(adapter.groups());
        rows.sort(Comparator.comparing(CodeGroup::getSortOrder).thenComparing(CodeGroup::getGroupCode));
        return rows;
    }

    /** 중지 코드를 제외하지 않으며 저장이나 이력 보정은 하지 않는다. */
    @Transactional(readOnly = true)
    public List<AdminCode> getGroupCodes(String group, DataScope scope) {
        permit("read");
        requireGroup(group, false);
        return readCodes(group);
    }

    /** 그룹 종류와 감사 주체는 서버 정책으로 정하고 그룹 ADD는 code=NULL로 기록한다. */
    @Transactional
    public CodeGroup createCodeGroup(CreateCodeGroupRequest request) {
        permit("create");
        if (request == null) {
            throw invalid("body");
        }
        Map<String, JsonNode> input = request.values();
        CodeGroup row = new CodeGroup();
        row.setGroupCode(identifier(text(input.get("group_code"), "group_code", 30, true), "group_code", false));
        row.setGroupName(text(input.get("group_name"), "group_name", 100, true));
        row.setAttr1Label(text(input.get("attr1_label"), "attr1_label", 50, false));
        row.setAttr2Label(text(input.get("attr2_label"), "attr2_label", 50, false));
        row.setAttr3Label(text(input.get("attr3_label"), "attr3_label", 50, false));
        try {
            adapter.addGroup(row, user.getUserId());
        } catch (DuplicateKeyException duplicate) {
            // POST has only a field validation error in the approved contract.
            throw invalid("group_code");
        }
        CodeGroup saved = adapter.group(row.getGroupCode(), false);
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("group_code", saved.getGroupCode());
        values.put("group_name", saved.getGroupName());
        values.put("group_kind", saved.getGroupKind());
        values.put("attr1_label", saved.getAttr1Label());
        values.put("attr2_label", saved.getAttr2Label());
        values.put("attr3_label", saved.getAttr3Label());
        values.put("sort_order", saved.getSortOrder());
        values.put("use_yn", saved.getUseYn());
        history.recordChanges(saved.getGroupCode(), null, null, values);
        return saved;
    }

    /** 그룹 잠금 후 모든 행을 먼저 검증한다. 누락/금지 변경은 어떤 행도 쓰기 전에 거절한다. */
    @Transactional
    public List<AdminCode> updateGroupCodes(String group, List<CodeWriteItem> request) {
        permit("update");
        CodeGroup parent = requireGroup(group, true);
        if (request == null) {
            throw invalid("body");
        }
        Map<String, AdminCode> existing = new LinkedHashMap<>();
        for (AdminCode row : readCodes(group)) {
            existing.put(row.getCode(), row);
        }
        Map<String, Map<String, Object>> proposed = new LinkedHashMap<>();
        for (CodeWriteItem item : request) {
            if (item == null) {
                throw invalid("body");
            }
            var input = item.values();
            String code = identifier(text(input.get("code"), "code", 30, true), "code", true);
            if (proposed.containsKey(code)) {
                throw ApiException.conflict("DUPLICATE_CODE");
            }
            Map<String, Object> values = new LinkedHashMap<>();
            values.put("code_name", text(input.get("code_name"), "code_name", 100, true));
            JsonNode order = input.get("sort_order");
            if (order == null || !order.isIntegralNumber() || !order.canConvertToInt()) {
                throw invalid("sort_order");
            }
            values.put("sort_order", order.intValue());
            for (String attr : List.of("attr1", "attr2", "attr3")) {
                if (input.containsKey(attr)) {
                    values.put(attr, attribute(input.get(attr), attr));
                }
            }
            if (input.containsKey("use_yn")) {
                String flag = text(input.get("use_yn"), "use_yn", 1, true);
                if (!"Y".equals(flag) && !"N".equals(flag)) {
                    throw invalid("use_yn");
                }
                values.put("use_yn", flag);
            }
            if (input.containsKey("effective_from")) {
                String date = text(input.get("effective_from"), "effective_from", 10, false);
                try {
                    if (date != null && !date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) {
                        throw invalid("effective_from");
                    }
                    values.put("effective_from", date == null ? null : LocalDate.parse(date));
                } catch (DateTimeParseException error) {
                    throw invalid("effective_from");
                }
            }
            proposed.put(code, values);
        }
        if (!proposed.keySet().containsAll(existing.keySet())) {
            throw invalid("code");
        }
        if ("SYSTEM".equals(parent.getGroupKind())) {
            for (var entry : proposed.entrySet()) {
                AdminCode old = existing.get(entry.getKey());
                if (old == null) {
                    throw ApiException.conflict("SYSTEM_CODE_LOCKED");
                }
                Map<String, Object> before = values(old);
                for (var field : entry.getValue().entrySet()) {
                    if (!List.of("code_name", "sort_order").contains(field.getKey())
                        && !Objects.equals(before.get(field.getKey()), field.getValue())) {
                        throw ApiException.conflict("SYSTEM_CODE_LOCKED");
                    }
                }
            }
        }
        for (var entry : proposed.entrySet()) {
            AdminCode old = existing.get(entry.getKey());
            var next = entry.getValue();
            if (old == null) {
                AdminCode row = new AdminCode();
                row.setGroupCode(group);
                row.setCode(entry.getKey());
                row.setCodeName((String) next.get("code_name"));
                row.setSortOrder((Integer) next.get("sort_order"));
                row.setAttr1((String) next.get("attr1"));
                row.setAttr2((String) next.get("attr2"));
                row.setAttr3((String) next.get("attr3"));
                row.setEffectiveFrom((LocalDate) next.get("effective_from"));
                row.setUseYn("Y");
                adapter.addCode(row, user.getUserId());
                Map<String, Object> added = values(row);
                added.put("code", row.getCode());
                history.recordChanges(group, row.getCode(), null, added);
            } else {
                Map<String, Object> before = values(old);
                Map<String, Object> changes = new LinkedHashMap<>();
                next.forEach((field, value) -> {
                    if (!Objects.equals(before.get(field), value)) {
                        changes.put(field, value);
                    }
                });
                if (!changes.isEmpty()) {
                    adapter.changeCode(group, old.getCode(), changes, user.getUserId());
                    history.recordChanges(group, old.getCode(), before, changes);
                }
            }
        }
        return readCodes(group);
    }

    private Map<String, Object> values(AdminCode row) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("code_name", row.getCodeName());
        values.put("sort_order", row.getSortOrder());
        values.put("attr1", row.getAttr1());
        values.put("attr2", row.getAttr2());
        values.put("attr3", row.getAttr3());
        values.put("use_yn", row.getUseYn());
        values.put("effective_from", row.getEffectiveFrom());
        return values;
    }

    private List<AdminCode> readCodes(String group) {
        List<AdminCode> rows = new ArrayList<>(adapter.codes(group));
        rows.sort(Comparator.comparing(AdminCode::getSortOrder).thenComparing(AdminCode::getCode));
        return rows;
    }

    private CodeGroup requireGroup(String group, boolean lock) {
        identifier(group, "group", false);
        CodeGroup row = adapter.group(group, lock);
        if (row == null) {
            throw new ApiException(404, "그룹 없음", null);
        }
        return row;
    }

    private String identifier(String value, String field, boolean code) {
        if (value == null || value.length() > 30 || !value.matches(code ? "[A-Z0-9_]+" : "[A-Z_]+")) {
            throw invalid(field);
        }
        return value;
    }

    private String attribute(JsonNode value, String field) {
        if (value != null && value.isNumber()) {
            String decimal = value.decimalValue().toPlainString();
            if (decimal.length() > 100) {
                throw invalid(field);
            }
            return decimal;
        }
        return text(value, field, 100, false);
    }

    private String text(JsonNode value, String field, int limit, boolean required) {
        if (value == null || value.isNull()) {
            if (required) {
                throw invalid(field);
            }
            return null;
        }
        if (!value.isTextual()) {
            throw invalid(field);
        }
        String text = value.textValue();
        if ((required && text.isBlank()) || text.codePointCount(0, text.length()) > limit) {
            throw invalid(field);
        }
        return text;
    }

    private void permit(String action) {
        if (!permission.can("UI-27." + action)) {
            throw new ApiException(403, "기능 사용 불가", null);
        }
    }

    private ApiException invalid(String field) {
        return new ApiException(400, "입력 오류", field);
    }
}
