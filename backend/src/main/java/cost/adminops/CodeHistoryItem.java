package cost.adminops;

import com.fasterxml.jackson.annotation.JsonProperty;
import cost.common.Sensitive;
import java.time.LocalDateTime;

/** 기존 감사 행을 snake_case로 노출하며 nullable 값과 BIGINT 문자열을 보존한다. */
public class CodeHistoryItem {
    private String groupCode;
    private String groupName;
    private String code;
    private String action;
    private String fieldName;
    @Sensitive
    private String beforeValue;
    @Sensitive
    private String afterValue;
    private String changedBy;
    private LocalDateTime changedAt;

    @JsonProperty("group_code")
    public String getGroupCode() {
        return groupCode;
    }

    public void setGroupCode(String groupCode) {
        this.groupCode = groupCode;
    }

    @JsonProperty("group_name")
    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    @JsonProperty("code")
    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    @JsonProperty("action")
    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    @JsonProperty("field_name")
    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    @JsonProperty("before_value")
    public String getBeforeValue() {
        return beforeValue;
    }

    public void setBeforeValue(String beforeValue) {
        this.beforeValue = beforeValue;
    }

    @JsonProperty("after_value")
    public String getAfterValue() {
        return afterValue;
    }

    public void setAfterValue(String afterValue) {
        this.afterValue = afterValue;
    }

    @JsonProperty("changed_by")
    public String getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(String changedBy) {
        this.changedBy = changedBy;
    }

    @JsonProperty("changed_at")
    public LocalDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(LocalDateTime changedAt) {
        this.changedAt = changedAt;
    }
}
