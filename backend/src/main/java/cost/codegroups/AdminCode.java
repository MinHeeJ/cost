package cost.codegroups;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 기존 공통코드 SQL 행과 snake_case 응답을 연결한다. */
public class AdminCode {
    private String groupCode;
    private String code;
    private String codeName;
    private String attr1;
    private String attr2;
    private String attr3;
    private Integer sortOrder;
    private String useYn;
    private java.time.LocalDate effectiveFrom;

    @JsonProperty("group_code")
    public String getGroupCode() {
        return groupCode;
    }

    public void setGroupCode(String value) {
        groupCode = value;
    }

    @JsonProperty("code")
    public String getCode() {
        return code;
    }

    public void setCode(String value) {
        code = value;
    }

    @JsonProperty("code_name")
    public String getCodeName() {
        return codeName;
    }

    public void setCodeName(String value) {
        codeName = value;
    }

    @JsonProperty("attr1")
    public String getAttr1() {
        return attr1;
    }

    public void setAttr1(String value) {
        attr1 = value;
    }

    @JsonProperty("attr2")
    public String getAttr2() {
        return attr2;
    }

    public void setAttr2(String value) {
        attr2 = value;
    }

    @JsonProperty("attr3")
    public String getAttr3() {
        return attr3;
    }

    public void setAttr3(String value) {
        attr3 = value;
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

    @JsonProperty("effective_from")
    public java.time.LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(java.time.LocalDate value) {
        effectiveFrom = value;
    }
}
