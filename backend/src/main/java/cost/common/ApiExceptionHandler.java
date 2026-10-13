package cost.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** MVC 입력·대상 부재·내부 실패를 민감 원인 없는 승인 오류 envelope로 변환한다. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> domain(ApiException error, HttpServletRequest request) {
        int status = error.getStatus();
        return failure(status, status == 400 ? error.getField() : null, request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> missing(
        MissingServletRequestParameterException error,
        HttpServletRequest request
    ) {
        return failure(400, error.getParameterName(), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> invalid(
        MethodArgumentTypeMismatchException error,
        HttpServletRequest request
    ) {
        return failure(400, error.getName(), request);
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiError> notFound(Exception error, HttpServletRequest request) {
        return failure(404, null, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error, HttpServletRequest request) {
        return failure(500, null, request);
    }

    private ResponseEntity<ApiError> failure(int status, String field, HttpServletRequest request) {
        String message = switch (status) {
            case 400 -> "입력값을 확인해 주세요.";
            case 404 -> "요청한 대상을 찾을 수 없습니다.";
            default -> "처리 중 오류가 발생했습니다. 다시 시도해 주세요.";
        };
        return ResponseEntity.status(status)
            .body(ApiError.of(status, message, field, RequestIdFilter.requestId(request)));
    }
}
