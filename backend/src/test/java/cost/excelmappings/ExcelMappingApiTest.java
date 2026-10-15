package cost.excelmappings;

import cost.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExcelMappingController.class)
@Import({ExcelMappingService.class, ExcelMappingAdapter.class, CodeHistoryWriter.class,
    CurrentUser.class, PermissionService.class, JsonConfiguration.class,
    RequestIdFilter.class, ApiExceptionHandler.class})
class ExcelMappingApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ExcelMappingMapper mapper;
    @MockBean CodeHistoryWriteMapper historyMapper;
    final Map<String, ExcelMapping> saved = new LinkedHashMap<>();
    final List<CodeHistoryEntry> histories = new ArrayList<>();

    @BeforeEach
    void persistenceBoundaryRetainsActualWrites() {
        saved.clear();
        histories.clear();
        saved.put("운영", row("운영", "MAIN", "원본", "Y"));
        when(mapper.selectAll()).thenAnswer(call -> saved.values().stream()
            .sorted(java.util.Comparator.comparing(ExcelMapping::getExcelLabel))
            .map(this::copy).toList());
        when(mapper.selectOne(anyString(), anyString(), anyString())).thenAnswer(call -> {
            ExcelMapping row = saved.get(call.getArgument(0));
            return row != null && row.getTargetGroup().equals(call.getArgument(1))
                && row.getTargetCode().equals(call.getArgument(2)) ? copy(row) : null;
        });
        when(mapper.lockCode("JOB", "OPS")).thenReturn("OPS");
        when(mapper.lockMapping(anyString(), anyString(), anyString())).thenAnswer(call ->
            saved.containsKey(call.getArgument(0)) ? 1L : null);
        when(mapper.insert(any(), isNull())).thenAnswer(call -> {
            ExcelMapping row = call.getArgument(0);
            saved.put(row.getExcelLabel(), copy(row));
            return 1;
        });
        when(mapper.update(any())).thenAnswer(call -> {
            ExcelMapping row = call.getArgument(0);
            saved.put(row.getExcelLabel(), copy(row));
            return 1;
        });
        when(historyMapper.insert(any())).thenAnswer(call -> {
            histories.add(call.getArgument(0));
            return 1;
        });
    }

    private ExcelMapping row(String label, String role, String note, String active) {
        ExcelMapping row = new ExcelMapping();
        row.setExcelLabel(label);
        row.setTargetGroup("JOB");
        row.setTargetCode("OPS");
        row.setMapRole(role);
        row.setNote(note);
        row.setUseYn(active);
        row.setGroupName("직무");
        row.setCodeName("운영");
        return row;
    }

    private ExcelMapping copy(ExcelMapping value) {
        return row(value.getExcelLabel(), value.getMapRole(), value.getNote(), value.getUseYn());
    }

    @Test
    void anonymousReadReturnsSortedNamesInactiveSavedValuesAndDoesNotWrite() throws Exception {
        saved.put("가나다", row("가나다", "SUB", null, "N"));
        String before = json.writeValueAsString(saved);
        mvc.perform(get("/api/admin/excel-mappings"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data[0].excel_label").value("가나다"))
            .andExpect(jsonPath("$.data[0].map_role").value("SUB"))
            .andExpect(jsonPath("$.data[0].note").isEmpty())
            .andExpect(jsonPath("$.data[0].use_yn").value("N"))
            .andExpect(jsonPath("$.data[1].code_name").value("운영"))
            .andExpect(jsonPath("$.data[1].group_name").value("직무"))
            .andExpect(jsonPath("$.data[1].mapping_id").doesNotExist());
        assertThat(json.writeValueAsString(saved)).isEqualTo(before);
        verify(mapper).selectAll();
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(historyMapper);
    }

    @Test
    void emptyReadIs200WithNoRequiredFilters() throws Exception {
        saved.clear();
        mvc.perform(get("/api/admin/excel-mappings"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        verifyNoInteractions(historyMapper);
    }

    @Test
    void anonymousCreateMaterializesWriteAndSixColumnAddHistoryThenReadback() throws Exception {
        mvc.perform(post("/api/admin/excel-mappings").contentType(MediaType.APPLICATION_JSON).content("""
            {"excel_label":"새 운영","target_group":"JOB","target_code":"OPS","map_role":"SUB","note":"메모"}
            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.excel_label").value("새 운영"))
            .andExpect(jsonPath("$.data.map_role").value("SUB"))
            .andExpect(jsonPath("$.data.note").value("메모"))
            .andExpect(jsonPath("$.data.use_yn").value("Y"));
        mvc.perform(get("/api/admin/excel-mappings"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2));
        assertThat(histories).hasSize(6).allSatisfy(entry -> {
            assertThat(entry.getGroupCode()).isEqualTo("JOB");
            assertThat(entry.getCode()).isEqualTo("OPS");
            assertThat(entry.getAction()).isEqualTo("ADD");
            assertThat(entry.getChangedBy()).isNull();
            assertThat(entry.getBeforeValue()).isNull();
        });
        assertThat(histories).extracting(CodeHistoryEntry::getAfterValue)
            .containsExactly("새 운영", "JOB", "OPS", "SUB", "메모", "Y");
        verify(mapper).insert(any(), isNull());
    }

    @Test
    void duplicateCreateIs409AndPreservesRowsAndHistory() throws Exception {
        String before = json.writeValueAsString(saved);
        mvc.perform(post("/api/admin/excel-mappings").contentType(MediaType.APPLICATION_JSON).content("""
            {"excel_label":"운영","target_group":"JOB","target_code":"OPS","map_role":"MAIN"}
            """))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_CODE"));
        assertThat(json.writeValueAsString(saved)).isEqualTo(before);
        verify(mapper, never()).insert(any(), any());
        verifyNoInteractions(historyMapper);
    }

    @Test
    void unknownCodeCreateIs404WithoutWrites() throws Exception {
        mvc.perform(post("/api/admin/excel-mappings").contentType(MediaType.APPLICATION_JSON).content("""
            {"excel_label":"새 값","target_group":"UNKNOWN","target_code":"NONE","map_role":"MAIN"}
            """))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        verify(mapper, never()).insert(any(), any());
        verifyNoInteractions(historyMapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"excel_label", "target_group", "target_code", "map_role"})
    void missingCreateFieldIs400(String field) throws Exception {
        var body = json.createObjectNode().put("excel_label", "새 값").put("target_group", "JOB")
            .put("target_code", "OPS").put("map_role", "MAIN");
        body.remove(field);
        invalid(post("/api/admin/excel-mappings"), body.toString(), field);
        verifyNoInteractions(mapper, historyMapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"OTHER", "main", ""})
    void invalidCreateRoleIs400(String value) throws Exception {
        var body = json.createObjectNode().put("excel_label", "새 값").put("target_group", "JOB")
            .put("target_code", "OPS").put("map_role", value);
        invalid(post("/api/admin/excel-mappings"), body.toString(), "map_role");
        verifyNoInteractions(mapper, historyMapper);
    }

    @Test
    void createRejectsOverlongLabelAndNoteAndUnknownFields() throws Exception {
        var body = json.createObjectNode().put("excel_label", "가".repeat(101)).put("target_group", "JOB")
            .put("target_code", "OPS").put("map_role", "MAIN");
        invalid(post("/api/admin/excel-mappings"), body.toString(), "excel_label");
        body.put("excel_label", "정상").put("note", "가".repeat(201));
        invalid(post("/api/admin/excel-mappings"), body.toString(), "note");
        body.remove("note");
        body.put("use_yn", "N");
        invalid(post("/api/admin/excel-mappings"), body.toString(), "use_yn");
        verifyNoInteractions(mapper, historyMapper);
    }

    @Test
    void anonymousPatchOnlyChangesAllowedFieldsWithOldNewHistoryAndReadback() throws Exception {
        mvc.perform(target().contentType(MediaType.APPLICATION_JSON)
                .content("{\"map_role\":\"SUB\",\"note\":\"새 메모\",\"use_yn\":\"N\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.excel_label").value("운영"))
            .andExpect(jsonPath("$.data.target_group").value("JOB"))
            .andExpect(jsonPath("$.data.target_code").value("OPS"))
            .andExpect(jsonPath("$.data.note").value("새 메모"));
        mvc.perform(get("/api/admin/excel-mappings"))
            .andExpect(jsonPath("$.data[0].map_role").value("SUB"))
            .andExpect(jsonPath("$.data[0].use_yn").value("N"));
        assertThat(histories).extracting(CodeHistoryEntry::getFieldName)
            .containsExactly("map_role", "note", "use_yn");
        assertThat(histories).extracting(CodeHistoryEntry::getBeforeValue)
            .containsExactly("MAIN", "원본", "Y");
        assertThat(histories).extracting(CodeHistoryEntry::getAfterValue)
            .containsExactly("SUB", "새 메모", "N");
        assertThat(histories).extracting(CodeHistoryEntry::getAction)
            .containsExactly("UPDATE", "UPDATE", "DISABLE");
        assertThat(histories).allSatisfy(entry -> assertThat(entry.getChangedBy()).isNull());
    }

    @Test
    void enablePatchRecordsEnable() throws Exception {
        saved.get("운영").setUseYn("N");
        mvc.perform(target().contentType(MediaType.APPLICATION_JSON).content("{\"use_yn\":\"Y\"}"))
            .andExpect(status().isOk());
        assertThat(histories).singleElement().satisfies(entry -> {
            assertThat(entry.getAction()).isEqualTo("ENABLE");
            assertThat(entry.getBeforeValue()).isEqualTo("N");
            assertThat(entry.getAfterValue()).isEqualTo("Y");
        });
    }

    @Test
    void omittedNoteIsPreservedWhileExplicitNullClearsIt() throws Exception {
        mvc.perform(target().contentType(MediaType.APPLICATION_JSON).content("{\"map_role\":\"SUB\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.note").value("원본"));
        mvc.perform(target().contentType(MediaType.APPLICATION_JSON).content("{\"note\":null}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.note").isEmpty());
        assertThat(histories.get(1).getBeforeValue()).isEqualTo("원본");
        assertThat(histories.get(1).getAfterValue()).isNull();
    }

    @Test
    void noOpPatchDoesNotWriteOrRecordHistory() throws Exception {
        mvc.perform(target().contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"원본\"}"))
            .andExpect(status().isOk());
        verify(mapper, never()).update(any());
        verifyNoInteractions(historyMapper);
    }

    @Test
    void absentMappingPatchIs404WithoutWrites() throws Exception {
        mvc.perform(patch("/api/admin/excel-mappings").param("excel_label", "없는 값")
                .param("target_group", "JOB").param("target_code", "OPS")
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":null}"))
            .andExpect(status().isNotFound());
        verify(mapper, never()).update(any());
        verifyNoInteractions(historyMapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {"excel_label", "target_group", "target_code"})
    void missingOrBlankPatchKeyIs400BeforePersistence(String key) throws Exception {
        var request = patch("/api/admin/excel-mappings");
        Map<String, String> keys = Map.of("excel_label", "운영", "target_group", "JOB", "target_code", "OPS");
        keys.forEach((name, value) -> { if (!name.equals(key)) request.param(name, value); });
        invalid(request, "{\"note\":null}", key);
        invalid(request.param(key, " "), "{\"note\":null}", key);
        verifyNoInteractions(mapper, historyMapper);
    }

    @ParameterizedTest
    @CsvSource(value = {
        "{}|body", "{\"excel_label\":\"불변\"}|excel_label",
        "{\"target_group\":\"JOB\"}|target_group", "{\"target_code\":\"OPS\"}|target_code",
        "{\"private\":true}|private", "{\"map_role\":\"BAD\"}|map_role",
        "{\"map_role\":null}|map_role", "{\"use_yn\":\"X\"}|use_yn",
        "{\"use_yn\":null}|use_yn", "{\"note\":123}|note", "{|body"
    }, delimiter = '|')
    void invalidPatchBodyIsFieldErrorWithoutWrites(String body, String field) throws Exception {
        invalid(target(), body, field);
        verifyNoInteractions(mapper, historyMapper);
    }

    @Test
    void historyFailureIsSafe500NotFalseSuccess() throws Exception {
        when(historyMapper.insert(any())).thenThrow(new IllegalStateException("SQL private password"));
        var result = mvc.perform(target().contentType(MediaType.APPLICATION_JSON).content("{\"note\":null}"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("SQL", "private", "password");
        // Mocked persistence does not prove rollback. The opt-in PostgreSQL test covers it.
    }

    @Test
    void classpathContractDeclaresAllThreePublicOperationsAndRuntimeRead() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<?, ?> document = new Yaml().load(input);
            Map<?, ?> paths = (Map<?, ?>) document.get("paths");
            Map<?, ?> operations = (Map<?, ?>) paths.get("/api/admin/excel-mappings");
            assertThat(((Map<?, ?>) operations.get("get")).get("operationId")).isEqualTo("getExcelMappings");
            assertThat(((Map<?, ?>) operations.get("post")).get("operationId"))
                .isEqualTo("createExcelMapping");
            assertThat(((Map<?, ?>) operations.get("patch")).get("operationId"))
                .isEqualTo("updateExcelMapping");
            for (String method : List.of("get", "post", "patch")) {
                assertThat((List<?>) ((Map<?, ?>) operations.get(method)).get("security")).isEmpty();
            }
        }
        mvc.perform(get("/api/admin/excel-mappings")).andExpect(status().isOk());
    }

    private MockHttpServletRequestBuilder target() {
        return patch("/api/admin/excel-mappings").param("excel_label", "운영")
            .param("target_group", "JOB").param("target_code", "OPS");
    }

    private void invalid(MockHttpServletRequestBuilder request, String body, String field) throws Exception {
        var result = mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("400"))
            .andExpect(jsonPath("$.field").value(field)).andReturn();
        var envelope = json.readTree(result.getResponse().getContentAsString());
        assertThat(envelope.get("requestId").asText()).isEqualTo(result.getResponse().getHeader("X-Request-Id"));
    }
}
