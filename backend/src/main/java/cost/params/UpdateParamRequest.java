package cost.params;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import cost.common.ApiException;
import java.math.BigDecimal;

/** 값 유형을 강제하고 생략과 명시적 NULL을 구분하는 적용월 입력이다. */
public class UpdateParamRequest {
    private String effectiveFrom;
    private BigDecimal numValue;
    private String textValue;
    private boolean numPresent;
    private boolean textPresent;

    @JsonSetter("effective_from")
    public void setEffectiveFrom(JsonNode value) {
        if (!value.isNull() && !value.isTextual()) {
            throw new ApiException(400, "연월 형식", "effective_from");
        }
        effectiveFrom = value.isNull() ? null : value.textValue();
    }

    @JsonSetter("num_value")
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = ParamNumberDeserializer.class)
    public void setNumValue(BigDecimal value) {
        numPresent = true;
        numValue = value;
    }

    @JsonSetter("text_value")
    public void setTextValue(JsonNode value) {
        textPresent = true;
        if (!value.isNull() && !value.isTextual()) {
            throw new ApiException(400, "문자 형식", "text_value");
        }
        textValue = value.isNull() ? null : value.textValue();
    }

    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public BigDecimal getNumValue() {
        return numValue;
    }

    public String getTextValue() {
        return textValue;
    }

    public boolean hasNumValue() {
        return numPresent;
    }

    public boolean hasTextValue() {
        return textPresent;
    }
}
