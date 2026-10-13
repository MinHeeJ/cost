package cost.common;

/** 서비스가 입력 필드와 HTTP 오류 상태를 안전한 공통 경계로 전달하는 예외. */
public class ApiException extends RuntimeException {
    private final int status;
    private final String field;

    public ApiException(int status, String message, String field) {
        super(message);
        this.status = status;
        this.field = field;
    }

    public int getStatus() {
        return status;
    }

    public String getField() {
        return field;
    }
}
