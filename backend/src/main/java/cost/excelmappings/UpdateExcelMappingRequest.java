package cost.excelmappings;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/** JSON 타입과 누락/명시 NULL을 유지하여 서비스에서 승인 필드만 검증한다. */
public class UpdateExcelMappingRequest {
    @JsonProperty("map_role")
    public JsonNode mapRole;

    @JsonProperty("note")
    public JsonNode note;

    @JsonProperty("use_yn")
    public JsonNode useYn;

}
