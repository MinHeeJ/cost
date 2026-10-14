package cost.excelmappings;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 대응 저장 행과 코드 이름을 snake_case 응답으로 전달한다. */
public class ExcelMapping {
    private String excelLabel;
    private String targetGroup;
    private String targetCode;
    private String mapRole;
    private String note;
    private String useYn;
    private String groupName;
    private String codeName;

    @JsonProperty("excel_label")
    public String getExcelLabel() {
        return excelLabel;
    }

    public void setExcelLabel(String value) {
        this.excelLabel = value;
    }

    @JsonProperty("target_group")
    public String getTargetGroup() {
        return targetGroup;
    }

    public void setTargetGroup(String value) {
        this.targetGroup = value;
    }

    @JsonProperty("target_code")
    public String getTargetCode() {
        return targetCode;
    }

    public void setTargetCode(String value) {
        this.targetCode = value;
    }

    @JsonProperty("map_role")
    public String getMapRole() {
        return mapRole;
    }

    public void setMapRole(String value) {
        this.mapRole = value;
    }

    @JsonProperty("note")
    public String getNote() {
        return note;
    }

    public void setNote(String value) {
        this.note = value;
    }

    @JsonProperty("use_yn")
    public String getUseYn() {
        return useYn;
    }

    public void setUseYn(String value) {
        this.useYn = value;
    }

    @JsonProperty("group_name")
    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String value) {
        this.groupName = value;
    }

    @JsonProperty("code_name")
    public String getCodeName() {
        return codeName;
    }

    public void setCodeName(String value) {
        this.codeName = value;
    }
}
