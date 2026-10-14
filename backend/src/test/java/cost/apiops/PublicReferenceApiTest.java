package cost.apiops;

import cost.common.ApiExceptionHandler;
import cost.common.PermissionService;
import cost.common.RequestIdFilter;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

@WebMvcTest(PublicReferenceController.class)
@Import({PublicReferenceService.class, PublicReferenceAdapter.class, PermissionService.class,
    RequestIdFilter.class, ApiExceptionHandler.class})
class PublicReferenceApiTest {
    @Autowired
    MockMvc mvc;
    @MockBean
    PublicReferenceMapper mapper;

    CodeOption code(String code, String name, String attr) {
        CodeOption item = new CodeOption();
        item.setCode(code);
        item.setName(name);
        item.setAttr1(attr);
        return item;
    }

    ParamItem param(String month, String number) {
        ParamItem item = new ParamItem();
        item.setParamKey("VAT_RATE");
        item.setEffectiveFrom(month);
        item.setParamName("부가세율");
        item.setNumValue(new BigDecimal(number));
        item.setUnit("%");
        item.setUsedIn("계약");
        return item;
    }

    @Test
    void anonymousCodesReturnOrderedOptionsWithUnmaskedStringAttributes() throws Exception {
        when(mapper.groupExists("JOB")).thenReturn(true);
        when(mapper.selectCodes("JOB")).thenReturn(List.of(code("BE", "개발", "200000"), code("NEW", "신규", null)));
        mvc.perform(get("/api/codes/{group}", "JOB"))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-Request-Id"))
            .andExpect(content().json("""
                {"success":true,"meta":{},"data":[
                  {"code":"BE","name":"개발","attr1":"200000","attr2":null,"attr3":null},
                  {"code":"NEW","name":"신규","attr1":null,"attr2":null,"attr3":null}]}
                """, true));
        verify(mapper).groupExists("JOB");
        verify(mapper).selectCodes("JOB");
        verifyNoMoreInteractions(mapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"job", "JOB1", "JOB-", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"})
    void invalidGroupIs400BeforePersistence(String group) throws Exception {
        mvc.perform(get("/api/codes/{group}", group))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("group"));
        verifyNoInteractions(mapper);
    }

    @Test
    void absentGroupIs404NotEmptySuccess() throws Exception {
        mvc.perform(get("/api/codes/{group}", "MISSING"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        verify(mapper).groupExists("MISSING");
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void existingGroupWithoutActiveCodesIsEmptySuccess() throws Exception {
        when(mapper.groupExists("JOB")).thenReturn(true);
        when(mapper.selectCodes("JOB")).thenReturn(List.of());
        mvc.perform(get("/api/codes/{group}", "JOB"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void anonymousParamReturnsBothMonthsAndAllSourceFieldsWithoutChangingRows() throws Exception {
        var old = param("2000-01", "10");
        var next = param("2026-11", "11");
        when(mapper.selectParam("VAT_RATE", "2026-10")).thenReturn(old);
        when(mapper.selectParam("VAT_RATE", "2026-11")).thenReturn(next);
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "2026-10"))
            .andExpect(status().isOk())
            .andExpect(content().json("""
                {"success":true,"meta":{},"data":{"param_key":"VAT_RATE","effective_from":"2000-01",
                 "param_name":"부가세율","num_value":10,"text_value":null,"unit":"%","used_in":"계약"}}
                """, true));
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "2026-11"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(11))
            .andExpect(jsonPath("$.data.effective_from").value("2026-11"));
        assertThat(old.getNumValue()).isEqualByComparingTo("10");
        assertThat(next.getNumValue()).isEqualByComparingTo("11");
        verify(mapper).selectParam("VAT_RATE", "2026-10");
        verify(mapper).selectParam("VAT_RATE", "2026-11");
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void missingMonthIs400BeforePersistence() throws Exception {
        mvc.perform(get("/api/params/{key}", "VAT_RATE"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("month"));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "2026-1", "2026-00", "2026-13", "abcd-10", "2026-10-01"})
    void malformedMonthIs400BeforePersistence(String month) throws Exception {
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", month))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("month"));
        verifyNoInteractions(mapper);
    }

    @Test
    void unknownParamIs404() throws Exception {
        mvc.perform(get("/api/params/{key}", "MISSING").param("month", "2026-10"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper).selectParam("MISSING", "2026-10");
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void monthBeforeFirstValueIs404() throws Exception {
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "1999-12"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        verify(mapper).selectParam("VAT_RATE", "1999-12");
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void codesFailureDoesNotLeakSqlAndHasMatchingInquiryId() throws Exception {
        when(mapper.groupExists("JOB")).thenThrow(new IllegalStateException("SQL secret"));
        var response = mvc.perform(get("/api/codes/{group}", "JOB"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
            .andExpect(jsonPath("$.field").isEmpty()).andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain("SQL secret");
        var body = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.getContentAsString());
        assertThat(body.get("requestId").asText()).isEqualTo(response.getHeader("X-Request-Id"));
    }

    @Test
    void paramFailureDoesNotLeakSql() throws Exception {
        when(mapper.selectParam("VAT_RATE", "2026-10")).thenThrow(new IllegalStateException("SQL secret"));
        var response = mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "2026-10"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
            .andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain("SQL secret");
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableContractMatchesExecutedOperations() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var paths = (Map<String, Object>) document.get("paths");
        var codes = (Map<String, Object>) ((Map<?, ?>) paths.get("/api/codes/{group}")).get("get");
        var params = (Map<String, Object>) ((Map<?, ?>) paths.get("/api/params/{key}")).get("get");
        assertThat(codes.get("operationId")).isEqualTo("getCodes");
        assertThat(params.get("operationId")).isEqualTo("getParam");
        assertThat((List<?>) codes.get("security")).isEmpty();
        assertThat((List<?>) params.get("security")).isEmpty();
        when(mapper.groupExists("JOB")).thenReturn(true);
        when(mapper.selectCodes("JOB")).thenReturn(List.of());
        when(mapper.selectParam("VAT_RATE", "2026-10")).thenReturn(param("2000-01", "10"));
        mvc.perform(get("/api/codes/{group}", "JOB"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        mvc.perform(get("/api/params/{key}", "VAT_RATE").param("month", "2026-10"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isMap());
    }
}
