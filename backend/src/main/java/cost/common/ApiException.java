package cost.common;

/** 서비스의 입력 필드와 도메인 코드를 안전한 HTTP 오류 경계로 전달한다. */
public class ApiException extends RuntimeException {
    private final int status;
    private final String field;
    private final String code;

    /** 기존 호출의 숫자 문자열 코드를 보존한다. message는 응답에 그대로 노출하지 않는다. */
    public ApiException(int status, String message, String field) {
        this(status, Integer.toString(status), message, field);
    }

    /** 도메인 충돌은 HTTP 상태와 별도의 업무 코드를 가진다. */
    public ApiException(int status, String code, String message, String field) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    public static ApiException conflict(String code) {
        return new ApiException(409, code, "업무 상태 충돌", null);
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public String getField() {
        return field;
    }
}
