package cost.codegroups;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.DecimalNode;
import java.io.IOException;

/** 숫자 attr 입력을 double로 반올림하지 않고 원본 십진 정밀도로 읽는다. */
public class CodeAttributeDeserializer extends JsonDeserializer<JsonNode> {
    @Override
    public JsonNode deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.currentToken() == JsonToken.VALUE_NUMBER_FLOAT
            || parser.currentToken() == JsonToken.VALUE_NUMBER_INT) {
            return DecimalNode.valueOf(parser.getDecimalValue());
        }
        return parser.readValueAsTree();
    }
}
