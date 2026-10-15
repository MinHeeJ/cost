package cost.codegroups;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.util.LinkedHashMap;
import java.util.Map;

/** JSON 타입과 생략/명시적 NULL을 구분하여 기존 값을 보존한다. */
public class CodeWriteItem {
    private final Map<String, JsonNode> values = new LinkedHashMap<>();

    public Map<String, JsonNode> values() {
        return values;
    }

    @JsonProperty("code")
    public void setCode(JsonNode value) {
        values.put("code", value);
    }

    @JsonProperty("code_name")
    public void setCodeName(JsonNode value) {
        values.put("code_name", value);
    }

    @JsonProperty("sort_order")
    public void setSortOrder(JsonNode value) {
        values.put("sort_order", value);
    }

    @JsonProperty("attr1")
    @JsonDeserialize(using = CodeAttributeDeserializer.class)
    public void setAttr1(JsonNode value) {
        values.put("attr1", value);
    }

    @JsonProperty("attr2")
    @JsonDeserialize(using = CodeAttributeDeserializer.class)
    public void setAttr2(JsonNode value) {
        values.put("attr2", value);
    }

    @JsonProperty("attr3")
    @JsonDeserialize(using = CodeAttributeDeserializer.class)
    public void setAttr3(JsonNode value) {
        values.put("attr3", value);
    }

    @JsonProperty("use_yn")
    public void setUseYn(JsonNode value) {
        values.put("use_yn", value);
    }

    @JsonProperty("effective_from")
    public void setEffectiveFrom(JsonNode value) {
        values.put("effective_from", value);
    }
}
