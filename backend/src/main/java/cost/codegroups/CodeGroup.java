package cost.codegroups;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 기존 공통코드 SQL 행과 snake_case 응답을 연결한다. */
public class CodeGroup {
    private String groupCode;
    private String groupName;
    private String groupKind;
    private String attr1Label;
    private String attr2Label;
    private String attr3Label;
    private Integer sortOrder;
    private String useYn;
    private Long codeCount;

    @JsonProperty("group_code")
    public String getGroupCode() {
        return groupCode;
    }

    public void setGroupCode(String value) {
        groupCode = value;
    }

    @JsonProperty("group_name")
    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String value) {
        groupName = value;
    }

    @JsonProperty("group_kind")
    public String getGroupKind() {
        return groupKind;
    }

    public void setGroupKind(String value) {
        groupKind = value;
    }

    @JsonProperty("attr1_label")
    public String getAttr1Label() {
        return attr1Label;
    }

    public void setAttr1Label(String value) {
        attr1Label = value;
    }

    @JsonProperty("attr2_label")
    public String getAttr2Label() {
        return attr2Label;
    }

    public void setAttr2Label(String value) {
        attr2Label = value;
    }

    @JsonProperty("attr3_label")
    public String getAttr3Label() {
        return attr3Label;
    }

    public void setAttr3Label(String value) {
        attr3Label = value;
    }

    @JsonProperty("sort_order")
    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer value) {
        sortOrder = value;
    }

    @JsonProperty("use_yn")
    public String getUseYn() {
        return useYn;
    }

    public void setUseYn(String value) {
        useYn = value;
    }

    @JsonProperty("code_count")
    public Long getCodeCount() {
        return codeCount;
    }

    public void setCodeCount(Long value) {
        codeCount = value;
    }
}
