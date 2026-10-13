package cost.common;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ResponseContractTest.ResponseController.class)
@Import({RequestIdFilter.class, ApiExceptionHandler.class, ResponseContractTest.ResponseController.class})
class ResponseContractTest {
    @Autowired
    MockMvc mvc;

    @RestController
    static class ResponseController {
        @GetMapping("/test/required")
        ApiResponse<String> required(@RequestParam String from) {
            return ApiResponse.of(from);
        }

        @GetMapping("/test/failure")
        ApiResponse<Void> failure() {
            throw new IllegalStateException("password=private SQL SELECT secret FROM sys_menu");
        }

        @GetMapping("/test/validation")
        ApiResponse<Void> validation() {
            throw new ApiException(400, "private internal detail", "to");
        }

        @GetMapping("/test/data")
        ApiResponse<List<String>> data() {
            return ApiResponse.of(List.of("value"));
        }
    }

    @Test
    void successDataIsNotNestedEnvelope() throws Exception {
        mvc.perform(get("/test/data"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":[\"value\"]}", true))
            .andExpect(header().exists("X-Request-Id"));
    }

    @Test
    void missingInputHasFieldAndMatchingRequestId() throws Exception {
        var result = mvc.perform(get("/test/required"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("from"))
            .andReturn();
        assertError(result, "400");
    }

    @Test
    void explicitValidationPreservesFieldWithoutLeakingCause() throws Exception {
        var result = mvc.perform(get("/test/validation"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("to"))
            .andReturn();
        assertError(result, "400");
        assertThat(result.getResponse().getContentAsString()).doesNotContain("private");
    }

    @Test
    void unregisteredUrlUses404Envelope() throws Exception {
        var result = mvc.perform(get("/api/not-registered"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andReturn();
        assertError(result, "404");
    }

    @Test
    void internalFailureHas500AndNoSensitiveLeakage() throws Exception {
        var result = mvc.perform(get("/test/failure"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andReturn();
        assertError(result, "500");
        assertThat(result.getResponse().getContentAsString())
            .doesNotContain("password", "private", "SELECT", "sys_menu", "stackTrace", "exception");
    }

    private void assertError(MvcResult result, String code) throws Exception {
        String requestId = result.getResponse().getHeader("X-Request-Id");
        UUID.fromString(requestId);
        var json = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.getResponse().getContentAsString());
        assertThat(json.size()).isEqualTo(6);
        assertThat(json.get("success").booleanValue()).isFalse();
        assertThat(json.get("meta").isObject()).isTrue();
        assertThat(json.get("meta").size()).isZero();
        assertThat(json.get("code").textValue()).isEqualTo(code);
        assertThat(json.get("message").textValue()).isNotBlank();
        assertThat(json.get("requestId").textValue()).isEqualTo(requestId);
    }
}
