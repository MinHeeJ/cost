package cost.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** 결과를 한 번만 감싸며 health에서는 약속되지 않은 data를 생략한다. */
public class ApiResponse<T> {
    private final T data;

    public ApiResponse(T data) {
        this.data = data;
    }

    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data);
    }

    public static ApiResponse<Void> empty() {
        return new ApiResponse<>(null);
    }

    public boolean isSuccess() {
        return true;
    }

    public Map<String, Object> getMeta() {
        return Map.of();
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public T getData() {
        return data;
    }
}
