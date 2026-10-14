package cost.codegroups;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;

/** JSON 타입과 생략/명시적 NULL을 구분하여 기존 값을 보존한다. */
public class CreateCodeGroupRequest {
    private final Map<String, JsonNode> values = new LinkedHashMap<>();

    public Map<String, JsonNode> values() {
        return values;
    }

    @JsonProperty("group_code")
    public void setGroupCode(JsonNode value) {
        values.put("group_code", value);
    }

    @JsonProperty("group_name")
    public void setGroupName(JsonNode value) {
        values.put("group_name", value);
    }

    @JsonProperty("attr1_label")
    public void setAttr1Label(JsonNode value) {
        values.put("attr1_label", value);
    }

    @JsonProperty("attr2_label")
    public void setAttr2Label(JsonNode value) {
        values.put("attr2_label", value);
    }

    @JsonProperty("attr3_label")
    public void setAttr3Label(JsonNode value) {
        values.put("attr3_label", value);
    }
}
