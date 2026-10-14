package cost.codegroups;

import cost.common.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 실제 MVC/service/history 경로의 계약 검증. mapper double은 SQL/DB 내구성 증거가 아니다. */
@WebMvcTest(CodeController.class)
@Import({CodeService.class, CodeAdapter.class, CodeHistoryWriter.class, CurrentUser.class,
    PermissionService.class, JsonConfiguration.class, RequestIdFilter.class, ApiExceptionHandler.class})
class CodeApiTest {
    @Autowired
    MockMvc mvc;
    @MockBean
    CodeMapper mapper;
    @MockBean
    CodeHistoryWriteMapper historyMapper;
    final Map<String, CodeGroup> groups = new LinkedHashMap<>();
    final List<AdminCode> codes = new ArrayList<>();
    final List<CodeHistoryEntry> histories = new ArrayList<>();

    CodeGroup group(String code, String kind, int order) {
        CodeGroup row = new CodeGroup();
        row.setGroupCode(code);
        row.setGroupName(code);
        row.setGroupKind(kind);
        row.setSortOrder(order);
        row.setUseYn("Y");
        row.setAttr1Label("수당");
        row.setCodeCount(2L);
        return row;
    }

    AdminCode code(String group, String code, int order, String use) {
        AdminCode row = new AdminCode();
        row.setGroupCode(group);
        row.setCode(code);
        row.setCodeName(code);
        row.setSortOrder(order);
        row.setUseYn(use);
        row.setAttr1("200000");
        row.setEffectiveFrom(LocalDate.of(2000, 1, 1));
        return row;
    }

    @BeforeEach
    void setup() {
        groups.clear();
        codes.clear();
        histories.clear();
        groups.put("POSITION", group("POSITION", "BIZ", 2));
        groups.put("CONTRACT_TYPE", group("CONTRACT_TYPE", "SYSTEM", 1));
        codes.add(code("POSITION", "TL", 1, "Y"));
        codes.add(code("POSITION", "OPS", 2, "N"));
        codes.add(code("CONTRACT_TYPE", "TK", 1, "Y"));
        when(mapper.selectGroups()).thenAnswer(invocation -> new ArrayList<>(groups.values()));
        when(mapper.selectGroup(anyString())).thenAnswer(invocation -> groups.get(invocation.getArgument(0)));
        when(mapper.lockGroup(anyString())).thenAnswer(invocation -> groups.get(invocation.getArgument(0)));
        when(mapper.selectCodes(anyString())).thenAnswer(invocation -> codes.stream()
            .filter(row -> row.getGroupCode().equals(invocation.getArgument(0))).toList());
        when(mapper.insertGroup(any(), isNull())).thenAnswer(invocation -> {
            CodeGroup row = invocation.getArgument(0);
            row.setGroupKind("BIZ");
            row.setSortOrder(0);
            row.setUseYn("Y");
            row.setCodeCount(0L);
            groups.put(row.getGroupCode(), row);
            return 1;
        });
        when(mapper.insertCode(any(), isNull())).thenAnswer(invocation -> {
            codes.add(invocation.getArgument(0));
            return 1;
        });
        when(mapper.updateCode(anyString(), anyString(), anyMap(), isNull())).thenAnswer(invocation -> {
            AdminCode row = codes.stream().filter(c -> c.getGroupCode().equals(invocation.getArgument(0))
                && c.getCode().equals(invocation.getArgument(1))).findFirst().orElseThrow();
            Map<String, Object> changes = invocation.getArgument(2);
            changes.forEach((field, value) -> {
                switch (field) {
                    case "code_name" -> row.setCodeName((String) value);
                    case "sort_order" -> row.setSortOrder((Integer) value);
                    case "attr1" -> row.setAttr1((String) value);
                    case "attr2" -> row.setAttr2((String) value);
                    case "attr3" -> row.setAttr3((String) value);
                    case "use_yn" -> row.setUseYn((String) value);
                    case "effective_from" -> row.setEffectiveFrom((LocalDate) value);
                    default -> throw new AssertionError(field);
                }
            });
            return 1;
        });
        when(historyMapper.insert(any())).thenAnswer(invocation -> {
            histories.add(invocation.getArgument(0));
            return 1;
        });
    }

    @Test
    void anonymousGroupsIncludeInactiveSortLabelsAndCountsWithoutWrites() throws Exception {
        groups.get("POSITION").setUseYn("N");
        mvc.perform(get("/api/admin/code-groups").param("page", "invalid").param("size", "invalid"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data[0].group_kind").value("SYSTEM"))
            .andExpect(jsonPath("$.data[1].use_yn").value("N"))
            .andExpect(jsonPath("$.data[1].attr1_label").value("수당"))
            .andExpect(jsonPath("$.data[1].code_count").value(2));
        verify(mapper).selectGroups();
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(historyMapper);
    }

    @Test
    void anonymousDetailIncludesDisabledCodesDatesAndRawAttributesWithoutWrites() throws Exception {
        mvc.perform(get("/api/admin/code-groups/{group}/codes", "POSITION"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].code").value("TL"))
            .andExpect(jsonPath("$.data[0].attr1").value("200000"))
            .andExpect(jsonPath("$.data[0].effective_from").value("2000-01-01"))
            .andExpect(jsonPath("$.data[1].use_yn").value("N"));
        verify(mapper).selectGroup("POSITION");
        verify(mapper).selectCodes("POSITION");
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(historyMapper);
    }

    @Test
    void systemDetailReturnsOriginalValues() throws Exception {
        mvc.perform(get("/api/admin/code-groups/{group}/codes", "CONTRACT_TYPE"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].attr1").value("200000"));
        verifyNoInteractions(historyMapper);
    }

    @Test
    void invalidGroupHasFieldAndDoesNotQuery() throws Exception {
        mvc.perform(get("/api/admin/code-groups/{group}/codes", "bad1"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("group"));
        verifyNoInteractions(mapper, historyMapper);
    }

    @Test
    void missingGroupIs404() throws Exception {
        mvc.perform(get("/api/admin/code-groups/{group}/codes", "UNKNOWN"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        verifyNoInteractions(historyMapper);
    }

    @Test
    void anonymousCreateUsesBizAndNullGroupHistoryWithoutChangingCodes() throws Exception {
        mvc.perform(post("/api/admin/code-groups").contentType("application/json").content("""
            {"group_code":"NEW_GROUP","group_name":"추가 그룹","attr1_label":"금액"}
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.group_kind").value("BIZ"))
            .andExpect(jsonPath("$.data.code_count").value(0));
        assertThat(codes).hasSize(3);
        assertThat(histories).hasSize(8).allSatisfy(entry -> {
            assertThat(entry.getCode()).isNull();
            assertThat(entry.getChangedBy()).isNull();
            assertThat(entry.getAction()).isEqualTo("ADD");
        });
        verify(mapper, never()).insertCode(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{}", "{\"group_code\":\"lower\",\"group_name\":\"x\"}",
        "{\"group_code\":\"A1\",\"group_name\":\"x\"}",
        "{\"group_code\":\"ABCDEFGHIJKLMNOPQRSTUVWXYZABCDE\",\"group_name\":\"x\"}",
        "{\"group_code\":\"ABC\"}", "{\"group_code\":\"ABC\",\"group_name\":null}",
        "{\"group_code\":\"ABC\",\"group_name\":5}",
        "{\"group_code\":\"ABC\",\"group_name\":\"x\",\"values\":{}}",
        "{\"group_code\":\"ABC\",\"group_name\":\"x\",\"group_kind\":\"SYSTEM\"}"
    })
    void invalidCreateHasFieldAndLeavesPersistenceUntouched(String body) throws Exception {
        mvc.perform(post("/api/admin/code-groups").contentType("application/json").content(body))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").isString());
        verifyNoInteractions(mapper, historyMapper);
    }

    @Test
    void createNamesAndLabelsRespectStorageLengths() throws Exception {
        String body = "{\"group_code\":\"ABC\",\"group_name\":\"" + "가".repeat(101) + "\"}";
        mvc.perform(post("/api/admin/code-groups").contentType("application/json").content(body))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("group_name"));
        String labels = "{\"group_code\":\"ABC\",\"group_name\":\"x\",\"attr1_label\":\""
            + "가".repeat(51) + "\"}";
        mvc.perform(post("/api/admin/code-groups").contentType("application/json").content(labels))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("attr1_label"));
        verifyNoInteractions(mapper, historyMapper);
    }

    @Test
    void anonymousUpdateRetainsOmittedFieldsAndRecordsExactPreviousAndNextDecimal() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"TL","sort_order":1,"attr1":250000},
             {"code":"OPS","code_name":"OPS","sort_order":2}]
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].attr1").value("250000"));
        mvc.perform(get("/api/admin/code-groups/{group}/codes", "POSITION"))
            .andExpect(jsonPath("$.data[0].effective_from").value("2000-01-01"));
        assertThat(histories).hasSize(1);
        var entry = histories.get(0);
        assertThat(entry.getBeforeValue()).isEqualTo("200000");
        assertThat(entry.getAfterValue()).isEqualTo("250000");
        assertThat(entry.getFieldName()).isEqualTo("attr1");
        assertThat(entry.getAction()).isEqualTo("UPDATE");
        assertThat(entry.getChangedBy()).isNull();
    }

    @Test
    void decimalPrecisionAndExplicitNullSurviveReadback() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"TL","sort_order":1,"attr1":12345678901234567890.123456789,
              "effective_from":null}, {"code":"OPS","code_name":"OPS","sort_order":2,"attr1":null}]
            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].attr1").value("12345678901234567890.123456789"))
            .andExpect(jsonPath("$.data[0].effective_from").isEmpty())
            .andExpect(jsonPath("$.data[1].attr1").isEmpty());
        assertThat(histories).hasSize(3);
    }

    @Test
    void noOpDoesNotWriteOrCreateHistory() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"TL","sort_order":1},{"code":"OPS","code_name":"OPS","sort_order":2}]
            """))
            .andExpect(status().isOk());
        verify(mapper, never()).updateCode(anyString(), anyString(), anyMap(), any());
        verifyNoInteractions(historyMapper);
    }

    @Test
    void bizNewCodeAlwaysActiveAndHasFieldLevelAddHistory() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"TL","sort_order":1},{"code":"OPS","code_name":"OPS","sort_order":2},
             {"code":"NEW","code_name":"새 코드","sort_order":3,"use_yn":"N"}]
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[2].use_yn").value("Y"));
        assertThat(histories).hasSize(8).allSatisfy(entry -> {
            assertThat(entry.getCode()).isEqualTo("NEW");
            assertThat(entry.getAction()).isEqualTo("ADD");
        });
    }

    @Test
    void disableKeepsRowAndCreatesDisableHistory() throws Exception {
        codes.get(1).setUseYn("Y");
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"TL","sort_order":1},
             {"code":"OPS","code_name":"OPS","sort_order":2,"use_yn":"N"}]
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[1].use_yn").value("N"));
        assertThat(codes).hasSize(3);
        assertThat(histories).singleElement().extracting(CodeHistoryEntry::getAction).isEqualTo("DISABLE");
    }

    @Test
    void enableKeepsRowAndCreatesEnableHistory() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"TL","sort_order":1},
             {"code":"OPS","code_name":"OPS","sort_order":2,"use_yn":"Y"}]
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[1].use_yn").value("Y"));
        assertThat(histories).singleElement().extracting(CodeHistoryEntry::getAction).isEqualTo("ENABLE");
    }

    @Test
    void systemNameAndOrderMayChangeWithIdenticalOptionalValues() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "CONTRACT_TYPE")
            .contentType("application/json").content("""
            [{"code":"TK","code_name":"수정","sort_order":2,"attr1":"200000","use_yn":"Y"}]
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].code_name").value("수정"));
        assertThat(histories).hasSize(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "[{\"code\":\"TK\",\"code_name\":\"TK\",\"sort_order\":1,\"use_yn\":\"N\"}]",
        "[{\"code\":\"TK\",\"code_name\":\"TK\",\"sort_order\":1,\"attr1\":null}]",
        "[{\"code\":\"TK\",\"code_name\":\"TK\",\"sort_order\":1,\"effective_from\":null}]",
        "[{\"code\":\"TK\",\"code_name\":\"TK\",\"sort_order\":1},"
            + "{\"code\":\"NEW\",\"code_name\":\"new\",\"sort_order\":2}]"
    })
    void systemForbiddenChangesAre409WithoutWrites(String body) throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "CONTRACT_TYPE")
            .contentType("application/json").content(body))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SYSTEM_CODE_LOCKED"));
        verify(mapper, never()).updateCode(anyString(), anyString(), anyMap(), any());
        verify(mapper, never()).insertCode(any(), any());
        verifyNoInteractions(historyMapper);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "[]", "[{\"code\":\"OTHER\",\"code_name\":\"x\",\"sort_order\":1}]",
        "[{\"code\":\"lower\",\"code_name\":\"x\",\"sort_order\":1}]",
        "[{\"code\":\"TL\",\"sort_order\":1}]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":null}]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":1.5}]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":1,\"use_yn\":null}]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":1,\"attr1\":true}]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":1,\"effective_from\":\"2026-02-30\"}]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":1,\"unknown\":1}]", "[null]",
        "[{\"code\":\"TL\",\"code_name\":\"x\",\"sort_order\":1,\"values\":{}}]"
    })
    void invalidWholeSetFailsBeforeAnyMutation(String body) throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content(body))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").isString());
        verify(mapper, never()).updateCode(anyString(), anyString(), anyMap(), any());
        verify(mapper, never()).insertCode(any(), any());
        verifyNoInteractions(historyMapper);
        assertThat(codes.get(0).getCodeName()).isEqualTo("TL");
    }

    @Test
    void duplicateCodeIs409AndNoRowsChange() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "POSITION")
            .contentType("application/json").content("""
            [{"code":"TL","code_name":"x","sort_order":1},{"code":"TL","code_name":"y","sort_order":2}]
            """))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_CODE"));
        verify(mapper, never()).updateCode(anyString(), anyString(), anyMap(), any());
        verifyNoInteractions(historyMapper);
    }

    @Test
    void missingWriteGroupIs404() throws Exception {
        mvc.perform(put("/api/admin/code-groups/{group}/codes", "UNKNOWN")
            .contentType("application/json").content("[]"))
            .andExpect(status().isNotFound());
        verifyNoInteractions(historyMapper);
    }

    @Test
    void persistenceFailureDoesNotExposeSqlAndRequestIdsMatch() throws Exception {
        when(mapper.selectGroups()).thenThrow(new IllegalStateException("SQL password secret"));
        var result = mvc.perform(get("/api/admin/code-groups"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
            .andReturn();
        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("SQL", "password", "secret");
        assertThat(body).contains(result.getResponse().getHeader("X-Request-Id"));
    }

    @Test
    void historyFailurePropagatesInsteadOfReportingWriteSuccess() throws Exception {
        when(historyMapper.insert(any())).thenThrow(new IllegalStateException("SQL history secret"));
        mvc.perform(post("/api/admin/code-groups").contentType("application/json").content("""
            {"group_code":"NEW_GROUP","group_name":"추가"}
            """))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableClasspathContractDefinesAllOwnedPublicOperations() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        Map<String, Object> paths = (Map<String, Object>) document.get("paths");
        for (String path : List.of("/api/admin/code-groups", "/api/admin/code-groups/{group}/codes")) {
            Map<String, Object> methods = (Map<String, Object>) paths.get(path);
            for (Object value : methods.values()) {
                Map<String, Object> operation = (Map<String, Object>) value;
                assertThat((List<?>) operation.get("security")).isEmpty();
                assertThat(operation.get("operationId")).isIn(
                    "getCodeGroups", "createCodeGroup", "getGroupCodes", "updateGroupCodes");
            }
        }
        mvc.perform(get("/api/admin/code-groups")).andExpect(status().isOk());
    }
}
