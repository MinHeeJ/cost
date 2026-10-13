package cost.shared;

import cost.common.ApiExceptionHandler;
import cost.common.RequestIdFilter;
import cost.shared.menu.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MenuController.class)
@Import({MenuService.class, MenuReadAdapter.class, RequestIdFilter.class, ApiExceptionHandler.class})
class MenuApiTest {
    @Autowired
    MockMvc mvc;
    @MockBean
    MenuMapper mapper;

    MenuRow row(long id, Long parent, String screen, int order, String active, String mobile) {
        MenuRow row = new MenuRow();
        row.setMenuId(id);
        row.setParentMenuId(parent);
        row.setMenuName("시험 " + id);
        row.setScreenId(screen);
        row.setSortOrder(order);
        row.setUseYn(active);
        row.setMobileYn(mobile);
        return row;
    }

    @Test
    void anonymousMenuPreservesDecimalIdsNullsAndMobileRestriction() throws Exception {
        long large = 9007199254740993L;
        when(mapper.selectActive()).thenReturn(List.of(
            row(large, null, null, 1, "Y", "Y"), row(large + 1, large, "UI-14", 1, "Y", "N")));
        mvc.perform(get("/api/menus"))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-Request-Id"))
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data[0].menu_id").value(Long.toString(large)))
            .andExpect(jsonPath("$.data[0].screen_id").isEmpty())
            .andExpect(jsonPath("$.data[0].parent_menu_id").isEmpty())
            .andExpect(jsonPath("$.data[0].children[0].mobile_yn").value("N"))
            .andExpect(jsonPath("$.data[0].children[0].children").isEmpty())
            .andExpect(jsonPath("$.data[0].created_at").doesNotExist());
        verify(mapper).selectActive();
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void inactiveRowsAndOrphansAreExcludedAndTiesUseMenuId() throws Exception {
        when(mapper.selectActive()).thenReturn(List.of(
            row(1, null, null, 1, "Y", "Y"), row(2, null, null, 2, "N", "Y"),
            row(12, 1L, "UI-02", 1, "Y", "Y"), row(11, 1L, "UI-01", 1, "Y", "Y"),
            row(13, 2L, "UI-03", 1, "Y", "Y"), row(14, 1L, "UI-04", 2, "N", "Y")));
        mvc.perform(get("/api/menus"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].children.length()").value(2))
            .andExpect(jsonPath("$.data[0].children[0].menu_id").value("11"))
            .andExpect(jsonPath("$.data[0].children[1].menu_id").value("12"));
    }

    @Test
    void emptyTreeIsSuccessNotNotFound() throws Exception {
        when(mapper.selectActive()).thenReturn(List.of());
        mvc.perform(get("/api/menus"))
            .andExpect(status().isOk())
            .andExpect(content().json("""
                {"success":true,"meta":{},"data":[]}
                """, true));
    }

    @Test
    void persistenceFailureHasSafeEnvelopeAndMatchingRequestId() throws Exception {
        when(mapper.selectActive()).thenThrow(new IllegalStateException("SQL secret"));
        var result = mvc.perform(get("/api/menus"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("500"))
            .andExpect(jsonPath("$.field").isEmpty())
            .andExpect(jsonPath("$.message").value("처리 중 오류가 발생했습니다. 다시 시도해 주세요."))
            .andReturn();
        mvc.perform(get("/api/menus"))
            .andExpect(jsonPath("$.requestId").isString());
        assertThat(result.getResponse().getContentAsString()).doesNotContain("SQL secret");
        var json = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.getResponse().getContentAsString());
        assertThat(json.get("requestId").asText()).isEqualTo(result.getResponse().getHeader("X-Request-Id"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void classpathContractDeclaresTheExecutedPublicOperation() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var paths = (Map<String, Object>) document.get("paths");
        var operation = (Map<String, Object>) ((Map<?, ?>) paths.get("/api/menus")).get("get");
        assertThat(operation.get("operationId")).isEqualTo("getMenus");
        assertThat((List<?>) operation.get("security")).isEmpty();
        when(mapper.selectActive()).thenReturn(List.of());
        mvc.perform(get("/api/menus")).andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
    }
}
