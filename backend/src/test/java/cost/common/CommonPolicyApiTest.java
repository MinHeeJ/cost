package cost.common;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CommonPolicyApiTest.PolicyController.class)
@Import({RequestIdFilter.class, ApiExceptionHandler.class, JsonConfiguration.class,
    CurrentUser.class, PermissionService.class, CommonPolicyApiTest.PolicyController.class})
class CommonPolicyApiTest {
    @Autowired
    MockMvc mvc;

    // Test-only transport exercises common policies, not a deployed business endpoint.
    @RestController
    static class PolicyController {
        private final CurrentUser user;
        private final PermissionService permissions;

        PolicyController(CurrentUser user, PermissionService permissions) {
            this.user = user;
            this.permissions = permissions;
        }

        @GetMapping("/test/common/user")
        ApiResponse<CurrentUser> user() {
            return ApiResponse.of(user);
        }

        @PutMapping("/test/common/write")
        ApiResponse<Input> write(@Valid @RequestBody Input input) {
            if (!permissions.can("UI-25.update") || !permissions.can("UI-27.create")) {
                throw new IllegalStateException("policy regression");
            }
            return ApiResponse.of(input);
        }

        @GetMapping("/test/common/conflict")
        ApiResponse<Void> conflict(@RequestParam String code) {
            throw new ApiException(409, code, "SQL private password", null);
        }

        @GetMapping("/test/common/missing")
        ApiResponse<Void> missing() {
            throw new ApiException(404, "SQL private", null);
        }
    }

    static class Input {
        @NotBlank
        @JsonProperty("menu_name")
        public String menuName;
        @Sensitive
        public String value;
    }

    @Test
    void currentUserHasExactFixedPolicyWithoutAuthentication() throws Exception {
        mvc.perform(get("/test/common/user"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.userId").isEmpty())
            .andExpect(jsonPath("$.data.name").value("기본 사용자"))
            .andExpect(jsonPath("$.data.roleIds[0]").value(1))
            .andExpect(jsonPath("$.data.roleIds.length()").value(1));
        assertThat(DataScope.values()).containsExactly(DataScope.ALL);
    }

    @Test
    void permissionKeysPermitAnonymousWriteAndSensitiveValueIsNotMasked() throws Exception {
        mvc.perform(put("/test/common/write").contentType(MediaType.APPLICATION_JSON)
                .content("{\"menu_name\":\"메뉴\",\"value\":\"250000\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.menu_name").value("메뉴"))
            .andExpect(jsonPath("$.data.value").value("250000"));
    }

    @Test
    void malformedJsonIs400BodyAndDoesNotLeakParserDetails() throws Exception {
        assertBadBody("{", "body");
    }

    @Test
    void unknownPropertyIs400FieldRatherThanSilentlyIgnored() throws Exception {
        assertBadBody("{\"menu_name\":\"메뉴\",\"private\":true}", "private");
    }

    @Test
    void invalidJsonTypeIs400Field() throws Exception {
        assertBadBody("{\"menu_name\":{}}", "menu_name");
    }

    @Test
    void missingRequiredBodyFieldIs400Field() throws Exception {
        assertBadBody("{}", "menu_name");
    }

    @ParameterizedTest
    @ValueSource(strings = {"DUPLICATE_CODE", "SYSTEM_CODE_LOCKED", "MENU_REQUIRED"})
    void domain409PreservesBusinessCodeAndSuppressesInternalCause(String code) throws Exception {
        var result = mvc.perform(get("/test/common/conflict").param("code", code))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value(code))
            .andExpect(jsonPath("$.field").isEmpty())
            .andReturn();
        assertSafeEnvelope(result);
    }

    @Test
    void legacy404KeepsNumericCodeAndSafeMessage() throws Exception {
        mvc.perform(get("/test/common/missing"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("404"))
            .andExpect(jsonPath("$.message").value("요청한 대상을 찾을 수 없습니다."));
    }

    @Test
    @SuppressWarnings("unchecked")
    void approvedFixtureKeepsAdminOperationsPublic() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var paths = (Map<String, Object>) document.get("paths");
        for (String path : new String[]{"/api/admin/menus", "/api/admin/code-groups"}) {
            for (Object item : ((Map<?, ?>) paths.get(path)).values()) {
                if (item instanceof Map<?, ?> operation && operation.containsKey("operationId")) {
                    assertThat((java.util.List<?>) operation.get("security")).isEmpty();
                }
            }
        }
    }

    private void assertBadBody(String body, String field) throws Exception {
        var result = mvc.perform(put("/test/common/write").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("400"))
            .andExpect(jsonPath("$.field").value(field))
            .andReturn();
        assertSafeEnvelope(result);
    }

    private void assertSafeEnvelope(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        var json = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.getResponse().getContentAsString());
        assertThat(json.size()).isEqualTo(6);
        assertThat(json.get("success").booleanValue()).isFalse();
        assertThat(json.get("requestId").asText()).isEqualTo(result.getResponse().getHeader("X-Request-Id"));
        assertThat(json.get("message").asText()).doesNotContain("SQL", "private", "password");
    }
}
