package cost.adminops;

import com.fasterxml.jackson.databind.ObjectMapper;
import cost.common.ApiExceptionHandler;
import cost.common.PermissionService;
import cost.common.RequestIdFilter;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

@WebMvcTest(CodeHistoryController.class)
@Import({CodeHistoryService.class, CodeHistoryAdapter.class, PermissionService.class,
    RequestIdFilter.class, ApiExceptionHandler.class})
class CodeHistoryApiTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    PermissionService permissions;
    @MockBean
    CodeHistoryMapper mapper;

    private CodeHistoryItem row(String group, String name, String code, String action, String field,
        String before, String after, String time) {
        CodeHistoryItem row = new CodeHistoryItem();
        row.setGroupCode(group);
        row.setGroupName(name);
        row.setCode(code);
        row.setAction(action);
        row.setFieldName(field);
        row.setBeforeValue(before);
        row.setAfterValue(after);
        row.setChangedAt(LocalDateTime.parse(time));
        return row;
    }

    @Test
    void anonymousHistoryReturnsTlUpdateAndOpsDisableWithNullActorAndUnmaskedValues() throws Exception {
        var tl = row("POSITION", "직위", "TL", "UPDATE", "attr1", "200000", "250000", "2026-10-14T10:00:00");
        var ops = row("JOB", "직무", "OPS", "DISABLE", "use_yn", "Y", "N", "2026-10-14T09:00:00");
        var before = json.writeValueAsString(List.of(tl, ops));
        when(mapper.count(null)).thenReturn(2L);
        when(mapper.selectPage(null, 50, 0L)).thenReturn(List.of(tl, ops));
        mvc.perform(get("/api/admin/code-history"))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-Request-Id"))
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.total").value(2))
            .andExpect(jsonPath("$.data.page").value(1))
            .andExpect(jsonPath("$.data.size").value(50))
            .andExpect(jsonPath("$.data.items[0].code").value("TL"))
            .andExpect(jsonPath("$.data.items[0].action").value("UPDATE"))
            .andExpect(jsonPath("$.data.items[0].field_name").value("attr1"))
            .andExpect(jsonPath("$.data.items[0].before_value").value("200000"))
            .andExpect(jsonPath("$.data.items[0].after_value").value("250000"))
            .andExpect(jsonPath("$.data.items[0].changed_by").isEmpty())
            .andExpect(jsonPath("$.data.items[0].changed_at").value("2026-10-14T10:00:00"))
            .andExpect(jsonPath("$.data.items[1].code").value("OPS"))
            .andExpect(jsonPath("$.data.items[1].action").value("DISABLE"))
            .andExpect(jsonPath("$.data.items[1].before_value").value("Y"))
            .andExpect(jsonPath("$.data.items[1].after_value").value("N"));
        assertThat(permissions.can("UI-27.read")).isTrue();
        assertThat(json.writeValueAsString(List.of(tl, ops))).isEqualTo(before);
        verify(mapper).count(null);
        verify(mapper).selectPage(null, 50, 0L);
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void groupFilterAndCountUseSameGroupWithParamNameAndDecimalActorString() throws Exception {
        var param = row("PARAM", "기준값", "VAT_RATE", "UPDATE", "num_value", "10", "11",
            "2026-10-14T10:00:00");
        param.setChangedBy("9007199254740993");
        when(mapper.count("PARAM")).thenReturn(21L);
        when(mapper.selectPage("PARAM", 20, 20L)).thenReturn(List.of(param));
        mvc.perform(get("/api/admin/code-history").param("group", "PARAM").param("page", "2").param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items.length()").value(1))
            .andExpect(jsonPath("$.data.items[0].group_code").value("PARAM"))
            .andExpect(jsonPath("$.data.items[0].group_name").value("기준값"))
            .andExpect(jsonPath("$.data.items[0].changed_by").value("9007199254740993"))
            .andExpect(jsonPath("$.data.total").value(21))
            .andExpect(jsonPath("$.data.page").value(2))
            .andExpect(jsonPath("$.data.size").value(20));
        verify(mapper).count("PARAM");
        verify(mapper).selectPage("PARAM", 20, 20L);
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void unknownGroupIsEmptySuccessWithoutCreatingGroupOrHistory() throws Exception {
        when(mapper.selectPage("UNKNOWN", 50, 0L)).thenReturn(List.of());
        mvc.perform(get("/api/admin/code-history").param("group", "UNKNOWN"))
            .andExpect(status().isOk())
            .andExpect(content().json("""
                {"success":true,"meta":{},"data":{"items":[],"total":0,"page":1,"size":50}}
                """, true));
        verify(mapper).count("UNKNOWN");
        verify(mapper).selectPage("UNKNOWN", 50, 0L);
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void groupAddKeepsNullCodeAndBeforeValue() throws Exception {
        var added = row("JOB", "직무", null, "ADD", "group_name", null, "직무", "2026-10-14T10:00:00");
        when(mapper.count(null)).thenReturn(1L);
        when(mapper.selectPage(null, 50, 0L)).thenReturn(List.of(added));
        mvc.perform(get("/api/admin/code-history"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].code").isEmpty())
            .andExpect(jsonPath("$.data.items[0].before_value").isEmpty())
            .andExpect(jsonPath("$.data.items[0].action").value("ADD"));
    }

    @ParameterizedTest
    @CsvSource({"page,0", "page,-1", "page,no", "page,1.5", "page,2147483648", "size,1", "size,21", "size,no"})
    void invalidPagingIsField400BeforeAnyPersistence(String field, String value) throws Exception {
        var result = mvc.perform(get("/api/admin/code-history").param(field, value))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("400"))
            .andExpect(jsonPath("$.field").value(field))
            .andReturn();
        assertThat(json.readTree(result.getResponse().getContentAsString()).get("requestId").asText())
            .isEqualTo(result.getResponse().getHeader("X-Request-Id"));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\t"})
    void emptyGroupIsField400WithoutPersistence(String group) throws Exception {
        mvc.perform(get("/api/admin/code-history").param("group", group))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("group"));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"page", "size"})
    void emptyPagingIsNotSilentlyDefaulted(String field) throws Exception {
        mvc.perform(get("/api/admin/code-history").param(field, ""))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value(field));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @ValueSource(ints = {20, 50, 100})
    void acceptedSizesReachMapper(int size) throws Exception {
        when(mapper.selectPage(null, size, 0L)).thenReturn(List.of());
        mvc.perform(get("/api/admin/code-history").param("size", Integer.toString(size)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.size").value(size));
        verify(mapper).selectPage(null, size, 0L);
    }

    @Test
    void largestPageUsesLongOffsetInsteadOfOverflow() throws Exception {
        long expected = 214748364600L;
        when(mapper.selectPage(null, 100, expected)).thenReturn(List.of());
        mvc.perform(get("/api/admin/code-history").param("page", "2147483647").param("size", "100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.page").value(2147483647));
        verify(mapper).selectPage(null, 100, expected);
    }

    @Test
    void persistenceFailureHasSafeMessageAndMatchingInquiryNumber() throws Exception {
        when(mapper.count(null)).thenThrow(new IllegalStateException("SQL password private"));
        var result = mvc.perform(get("/api/admin/code-history"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("500"))
            .andExpect(jsonPath("$.field").isEmpty())
            .andExpect(jsonPath("$.message").value("처리 중 오류가 발생했습니다. 다시 시도해 주세요."))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("SQL", "password", "private");
        assertThat(json.readTree(result.getResponse().getContentAsString()).get("requestId").asText())
            .isEqualTo(result.getResponse().getHeader("X-Request-Id"));
        verify(mapper).count(null);
        verifyNoMoreInteractions(mapper);
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableContractMatchesExecutedOperationAndPageShape() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var operation = (Map<?, ?>) ((Map<?, ?>) ((Map<?, ?>) document.get("paths"))
            .get("/api/admin/code-history")).get("get");
        assertThat(operation.get("operationId")).isEqualTo("getCodeHistory");
        assertThat((List<?>) operation.get("security")).isEmpty();
        assertThat(operation.get("x-permission-key")).isEqualTo("UI-27.read");
        var schemas = (Map<?, ?>) ((Map<?, ?>) document.get("components")).get("schemas");
        var required = (List<String>) ((Map<?, ?>) schemas.get("CodeHistoryPage")).get("required");
        when(mapper.selectPage(null, 50, 0L)).thenReturn(List.of());
        var result = mvc.perform(get("/api/admin/code-history"))
            .andExpect(status().isOk()).andReturn();
        var data = json.readTree(result.getResponse().getContentAsString()).get("data");
        for (String field : required) {
            assertThat(data.has(field)).isTrue();
        }
    }
}
