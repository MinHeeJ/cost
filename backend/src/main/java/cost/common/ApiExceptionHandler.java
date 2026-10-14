package cost.common;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
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
        if (status == 409) {
            String message = switch (error.getCode()) {
                case "DUPLICATE_CODE" -> "이미 존재하는 코드 또는 대응입니다.";
                case "SYSTEM_CODE_LOCKED" -> "시스템 코드는 이름과 순서만 변경할 수 있습니다.";
                case "MENU_REQUIRED" -> "필수 메뉴는 사용 중지할 수 없습니다.";
                default -> "현재 상태에서는 변경할 수 없습니다.";
            };
            String code = switch (error.getCode()) {
                case "DUPLICATE_CODE", "SYSTEM_CODE_LOCKED", "MENU_REQUIRED" -> error.getCode();
                default -> "409";
            };
            return ResponseEntity.status(409)
                .body(ApiError.of(code, message, null, RequestIdFilter.requestId(request)));
        }
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

    /** JSON 원인은 공개하지 않고 wire 필드 경로만 전달한다. 문법 오류는 body를 지목한다. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> body(HttpMessageNotReadableException error, HttpServletRequest request) {
        String field = "body";
        for (Throwable cause = error.getCause(); cause != null; cause = cause.getCause()) {
            if (cause instanceof UnrecognizedPropertyException unknown) {
                field = unknown.getPropertyName();
                break;
            }
            if (cause instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
                var reference = mapping.getPath().get(mapping.getPath().size() - 1);
                if (reference.getFieldName() != null) {
                    field = reference.getFieldName();
                }
            }
        }
        return failure(400, field, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException error, HttpServletRequest request) {
        var field = error.getBindingResult().getFieldError();
        String name = field == null ? "body" : field.getField();
        // DTO의 camelCase Java 속성을 승인된 snake_case wire 필드로 돌려준다.
        name = name.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase(java.util.Locale.ROOT);
        return failure(400, name, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> constraint(ConstraintViolationException error, HttpServletRequest request) {
        String field = error.getConstraintViolations().stream()
            .map(violation -> violation.getPropertyPath().toString())
            .sorted()
            .findFirst()
            .orElse("body");
        return failure(400, field.substring(field.lastIndexOf('.') + 1), request);
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
