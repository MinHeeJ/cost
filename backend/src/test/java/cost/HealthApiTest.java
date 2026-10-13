package cost;

import cost.common.ApiExceptionHandler;
import cost.common.RequestIdFilter;
import cost.health.HealthController;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
@Import({RequestIdFilter.class, ApiExceptionHandler.class})
class HealthApiTest {
    @Autowired
    MockMvc mvc;

    @Test
    void happyHealthHasOnlyApprovedEnvelopeAndUuid() throws Exception {
        var result = mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true))
            .andExpect(header().exists("X-Request-Id"))
            .andReturn();
        UUID.fromString(result.getResponse().getHeader("X-Request-Id"));
    }

    @Test
    void anonymousHealthDoesNotRequireLoginOrTrustIncomingRequestId() throws Exception {
        var first = mvc.perform(get("/api/health").header("X-Request-Id", "external-id"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andReturn();
        var second = mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andReturn();
        assertThat(first.getResponse().getHeader("X-Request-Id"))
            .isNotEqualTo("external-id")
            .isNotEqualTo(second.getResponse().getHeader("X-Request-Id"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableOpenApiFixtureAgreesWithPublicHealthBehavior() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var paths = (Map<String, Object>) document.get("paths");
        var path = (Map<String, Object>) paths.get("/api/health");
        var operation = (Map<String, Object>) path.get("get");
        assertThat(operation.get("operationId")).isEqualTo("getHealth");
        assertThat((java.util.List<?>) operation.get("security")).isEmpty();
        var responses = (Map<String, Object>) operation.get("responses");
        assertThat(responses).containsKeys("200", "404", "500");
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true));
    }
}
