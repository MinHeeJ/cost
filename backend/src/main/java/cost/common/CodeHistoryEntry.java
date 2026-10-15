package cost.common;

/** 이력 INSERT 전용 값 객체. 감사 주체와 항목별 전후 값을 함께 전달한다. */
public class CodeHistoryEntry {
    private final String groupCode;
    private final String code;
    private final String action;
    private final String fieldName;
    private final String beforeValue;
    private final String afterValue;
    private final Long changedBy;

    public CodeHistoryEntry(
        String groupCode,
        String code,
        String action,
        String fieldName,
        String beforeValue,
        String afterValue,
        Long changedBy
    ) {
        this.groupCode = groupCode;
        this.code = code;
        this.action = action;
        this.fieldName = fieldName;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
        this.changedBy = changedBy;
    }

    public String getGroupCode() {
        return groupCode;
    }

    public String getCode() {
        return code;
    }

    public String getAction() {
        return action;
    }

    public String getFieldName() {
        return fieldName;
    }

    public String getBeforeValue() {
        return beforeValue;
    }

    public String getAfterValue() {
        return afterValue;
    }

    public Long getChangedBy() {
        return changedBy;
    }
}
