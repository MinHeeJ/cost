package cost.params;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/** 기준값 공개 투영과 새 적용월에 보존할 내부 메타데이터를 담는다. */
public class ParamItem {
    private String paramKey;
    private String effectiveFrom;
    private String paramName;
    private BigDecimal numValue;
    private String textValue;
    private String unit;
    private String usedIn;
    private String description;
    private Long createdBy;

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
    public BigDecimal getNumValue() {
        return numValue;
    }

    public void setNumValue(BigDecimal value) {
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

    @JsonIgnore
    public String getDescription() {
        return description;
    }

    public void setDescription(String value) {
        this.description = value;
    }

    @JsonIgnore
    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long value) {
        this.createdBy = value;
    }
}
