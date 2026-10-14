package cost.common;

import java.util.Map;

/** 문의 번호를 포함하는 단일 오류 envelope; 내부 원인과 감사 정보를 노출하지 않는다. */
public record ApiError(
    boolean success,
    Map<String, Object> meta,
    String code,
    String message,
    String field,
    String requestId
) {
    public static ApiError of(int status, String message, String field, String requestId) {
        return of(Integer.toString(status), message, field, requestId);
    }

    public static ApiError of(String code, String message, String field, String requestId) {
        return new ApiError(false, Map.of(), code, message, field, requestId);
    }
}
