package cost.apiops;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 공개 조회의 원본 값을 보존하는 XML materialization 및 응답 모델. */
public class CodeOption {
    private String code;
    private String name;
    private String attr1;
    private String attr2;
    private String attr3;

    @JsonProperty("code")
    public String getCode() {
        return code;
    }

    public void setCode(String value) {
        this.code = value;
    }

    @JsonProperty("name")
    public String getName() {
        return name;
    }

    public void setName(String value) {
        this.name = value;
    }

    @JsonProperty("attr1")
    public String getAttr1() {
        return attr1;
    }

    public void setAttr1(String value) {
        this.attr1 = value;
    }

    @JsonProperty("attr2")
    public String getAttr2() {
        return attr2;
    }

    public void setAttr2(String value) {
        this.attr2 = value;
    }

    @JsonProperty("attr3")
    public String getAttr3() {
        return attr3;
    }

    public void setAttr3(String value) {
        this.attr3 = value;
    }
}
