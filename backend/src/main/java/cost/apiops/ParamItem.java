package cost.apiops;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 공개 조회의 원본 값을 보존하는 XML materialization 및 응답 모델. */
public class ParamItem {
    private String paramKey;
    private String effectiveFrom;
    private String paramName;
    private java.math.BigDecimal numValue;
    private String textValue;
    private String unit;
    private String usedIn;

    @JsonProperty("param_key")
    public String getParamKey() {
        return paramKey;
    }

    public void setParamKey(String value) {
        this.paramKey = value;
    }

    @JsonProperty("effective_from")
    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(String value) {
        this.effectiveFrom = value;
    }

    @JsonProperty("param_name")
    public String getParamName() {
        return paramName;
    }

    public void setParamName(String value) {
        this.paramName = value;
    }

    @JsonProperty("num_value")
    public java.math.BigDecimal getNumValue() {
        return numValue;
    }

    public void setNumValue(java.math.BigDecimal value) {
        this.numValue = value;
    }

    @JsonProperty("text_value")
    public String getTextValue() {
        return textValue;
    }

    public void setTextValue(String value) {
        this.textValue = value;
    }

    @JsonProperty("unit")
    public String getUnit() {
        return unit;
    }

    public void setUnit(String value) {
        this.unit = value;
    }

    @JsonProperty("used_in")
    public String getUsedIn() {
        return usedIn;
    }

    public void setUsedIn(String value) {
        this.usedIn = value;
    }
}
