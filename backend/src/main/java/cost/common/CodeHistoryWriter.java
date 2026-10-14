package cost.common;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 코드·기준값·대응 변경 컬럼을 원본 쓰기와 같은 트랜잭션으로 기록한다. */
@Service
public class CodeHistoryWriter {
    private final CodeHistoryWriteMapper mapper;
    private final CurrentUser currentUser;

    public CodeHistoryWriter(CodeHistoryWriteMapper mapper, CurrentUser currentUser) {
        this.mapper = mapper;
        this.currentUser = currentUser;
    }

    /** 그룹은 code=NULL, 기준값은 PARAM/key, 대응은 target_group/target_code를 전달한다.
     * before=null은 신규 항목이며 값이 NULL인 컬럼도 ADD로 기록한다.
     * 기존 항목은 before/after가 같은 컬럼을 기록하지 않는다. 누락한 컬럼은 비교 대상이 아니다.
     * MANDATORY는 이력만 따로 커밋되는 경로를 막고 실패를 업무 쓰기까지 전파한다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordChanges(
        String groupCode,
        String code,
        Map<String, ?> before,
        Map<String, ?> after
    ) {
        validate(groupCode, 30, "group");
        if (code != null) {
            validate(code, 30, "PARAM".equals(groupCode) ? "key" : "code");
        }
        Objects.requireNonNull(after, "after");
        var entries = new java.util.ArrayList<CodeHistoryEntry>();
        for (String field : new LinkedHashSet<>(after.keySet())) {
            Object previous = before == null ? null : before.get(field);
            Object next = after.get(field);
            if (before != null && Objects.equals(previous, next)) {
                continue;
            }
            validate(field, 50, "field_name");
            String oldValue = value(previous);
            String newValue = value(next);
            String action = before == null ? "ADD" : "UPDATE";
            if (before != null && "use_yn".equals(field)) {
                if ("Y".equals(previous) && "N".equals(next)) {
                    action = "DISABLE";
                } else if ("N".equals(previous) && "Y".equals(next)) {
                    action = "ENABLE";
                }
            }
            entries.add(new CodeHistoryEntry(
                groupCode, code, action, field, oldValue, newValue, currentUser.getUserId()
            ));
        }
        // 모든 항목을 먼저 검증하여 입력 오류가 부분 이력을 만들지 않게 한다.
        for (CodeHistoryEntry entry : entries) {
            if (mapper.insert(entry) != 1) {
                throw new IllegalStateException("History insert failed");
            }
        }
    }

    private String value(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString();
        validate(text, 500, "value");
        return text;
    }

    private void validate(String value, int limit, String field) {
        if (value == null || value.codePointCount(0, value.length()) > limit) {
            throw new ApiException(400, "이력 항목 길이를 확인해 주세요.", field);
        }
    }
}
