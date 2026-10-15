package cost.params;

import cost.common.*;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 실제 controller/service/writer와 persistence double을 연결한 HTTP 계약 검증. SQL 실행 증거는 아니다. */
@WebMvcTest(ParamController.class)
@Import({ParamService.class, ParamAdapter.class, CodeHistoryWriter.class, CurrentUser.class,
    PermissionService.class, JsonConfiguration.class, RequestIdFilter.class, ApiExceptionHandler.class})
class ParamApiTest {
    @Autowired
    MockMvc mvc;
    @MockBean
    ParamMapper mapper;
    @MockBean
    CodeHistoryWriteMapper history;
    @MockBean(name = "paramsClock")
    Clock clock;
    final List<ParamItem> rows = new ArrayList<>();
    final List<CodeHistoryEntry> entries = new ArrayList<>();

    @BeforeEach
    void setupPersistenceBoundary() {
        rows.clear();
        entries.clear();
        rows.add(row("VAT_RATE", "2000-01", "10.0000"));
        Clock fixed = Clock.fixed(Instant.parse("2026-10-13T15:01:00Z"), ZoneId.of("Asia/Seoul"));
        when(clock.withZone(any())).thenReturn(fixed);
        when(mapper.selectAll()).thenAnswer(call -> List.copyOf(rows));
        when(mapper.selectHistory(anyString())).thenAnswer(call -> matching(call.getArgument(0)));
        when(mapper.lockHistory(anyString())).thenAnswer(call -> matching(call.getArgument(0)));
        when(mapper.selectLastClosed()).thenReturn("2026-09");
        when(mapper.insert(any())).thenAnswer(call -> {
            rows.add(call.getArgument(0));
            return 1;
        });
        when(mapper.updateValues(any())).thenAnswer(call -> {
            ParamItem saved = call.getArgument(0);
            ParamItem previous = rows.stream().filter(item -> item.getParamKey().equals(saved.getParamKey())
                && item.getEffectiveFrom().equals(saved.getEffectiveFrom())).findFirst().orElseThrow();
            previous.setNumValue(saved.getNumValue());
            previous.setTextValue(saved.getTextValue());
            return 1;
        });
        when(history.insert(any())).thenAnswer(call -> {
            entries.add(call.getArgument(0));
            return 1;
        });
    }

    private List<ParamItem> matching(String key) {
        return rows.stream().filter(item -> item.getParamKey().equals(key)).toList();
    }

    private ParamItem row(String key, String month, String value) {
        ParamItem row = new ParamItem();
        row.setParamKey(key);
        row.setEffectiveFrom(month);
        row.setParamName("기준값 " + key);
        row.setNumValue(value == null ? null : new BigDecimal(value));
        row.setUnit("단위");
        row.setUsedIn("사용처");
        row.setDescription("복사할 내부 설명");
        return row;
    }

    @Test
    void anonymousCurrentListExcludesFutureAndSelectsLatestPerKeyWithoutWrites() throws Exception {
        rows.add(row("VAT_RATE", "2026-11", "11"));
        rows.add(row("OTHER", "2026-10", "20"));
        rows.add(row("OTHER", "2025-01", "19"));
        mvc.perform(get("/api/admin/params"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[0].num_value").value(20))
            .andExpect(jsonPath("$.data[1].effective_from").value("2000-01"))
            .andExpect(jsonPath("$.data[1].num_value").value(10))
            .andExpect(jsonPath("$.data[1].text_value").isEmpty())
            .andExpect(jsonPath("$.data[1].description").doesNotExist());
        assertThat(rows).hasSize(4);
        verify(mapper).selectAll();
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(history);
    }

    @Test
    void currentMonthUsesSeoulEvenAtUtcPreviousMonthBoundary() throws Exception {
        when(clock.withZone(any())).thenReturn(Clock.fixed(
            Instant.parse("2026-09-30T15:00:00Z"), ZoneId.of("Asia/Seoul")));
        rows.add(row("VAT_RATE", "2026-10", "12"));
        mvc.perform(get("/api/admin/params"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].num_value").value(12));
    }

    @Test
    void emptyCurrentListWithoutQueryParametersReturnsArray() throws Exception {
        rows.clear();
        mvc.perform(get("/api/admin/params"))
            .andExpect(status().isOk()).andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":[]}"));
        verifyNoInteractions(history);
    }

    @Test
    void anonymousHistoryIncludesFutureInDescendingOrderWithoutPaginationOrMutation() throws Exception {
        rows.add(row("VAT_RATE", "2026-11", "11"));
        mvc.perform(get("/api/admin/params/{key}/history", "VAT_RATE"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[0].effective_from").value("2026-11"))
            .andExpect(jsonPath("$.data[1].num_value").value(10))
            .andExpect(jsonPath("$.total").doesNotExist());
        assertThat(rows).hasSize(2);
        verify(mapper).selectHistory("VAT_RATE");
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(history);
    }

    @Test
    void missingHistoryReturns404AndDoesNotWrite() throws Exception {
        mvc.perform(get("/api/admin/params/{key}/history", "MISSING"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertNoWrites();
    }

    @Test
    void anonymousNewMonthAppendPreservesEarlierRowAndCopiesMetadataAndNullActor() throws Exception {
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":11}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(11))
            .andExpect(jsonPath("$.data.unit").value("단위"));
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).getNumValue()).isEqualByComparingTo("10");
        assertThat(rows.get(1).getDescription()).isEqualTo("복사할 내부 설명");
        assertThat(rows.get(1).getCreatedBy()).isNull();
        assertThat(entries).extracting(CodeHistoryEntry::getAction).containsOnly("ADD");
        assertThat(entries).allSatisfy(entry -> {
            assertThat(entry.getGroupCode()).isEqualTo("PARAM");
            assertThat(entry.getCode()).isEqualTo("VAT_RATE");
            assertThat(entry.getChangedBy()).isNull();
            assertThat(entry.getBeforeValue()).isNull();
        });
        mvc.perform(get("/api/admin/params/{key}/history", "VAT_RATE"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].num_value").value(11));
        mvc.perform(get("/api/admin/params"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].num_value").value(10));
    }

    @Test
    void sameMonthUpdatesOnlyValueAndRecordsOldAndNewWithoutAddingRow() throws Exception {
        rows.add(row("VAT_RATE", "2026-11", "11"));
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":12}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.param_name").value("기준값 VAT_RATE"));
        assertThat(rows).hasSize(2);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).getAction()).isEqualTo("UPDATE");
        assertThat(entries.get(0).getFieldName()).isEqualTo("num_value");
        assertThat(entries.get(0).getBeforeValue()).isEqualTo("11");
        assertThat(entries.get(0).getAfterValue()).isEqualTo("12");
        mvc.perform(get("/api/admin/params/{key}/history", "VAT_RATE"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].num_value").value(12));
        verify(mapper, never()).insert(any());
    }

    @Test
    void sameValueWithDifferentScaleIsNoop() throws Exception {
        rows.add(row("VAT_RATE", "2026-11", "11.0000"));
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":11}"))
            .andExpect(status().isOk());
        assertNoWrites();
    }

    @Test
    void closedMonthIsRejectedBeforeAnyWrite() throws Exception {
        bad("{\"effective_from\":\"2026-09\",\"num_value\":11}", "effective_from");
    }

    @Test
    void nextMonthAfterLastClosedIsAllowed() throws Exception {
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-10\",\"num_value\":11}"))
            .andExpect(status().isOk());
        assertThat(rows).hasSize(2);
    }

    @Test
    void noClosedMonthAllowsValidEarlierMonthAndCopiesEarliestMetadata() throws Exception {
        when(mapper.selectLastClosed()).thenReturn(null);
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"1999-12\",\"num_value\":-1}"))
            .andExpect(status().isOk());
        assertThat(rows.get(1).getParamName()).isEqualTo(rows.get(0).getParamName());
    }

    @Test
    void newMonthCopiesLatestEarlierMetadataNotFutureMetadata() throws Exception {
        ParamItem future = row("VAT_RATE", "2027-01", "13");
        future.setDescription("미래 설명");
        rows.add(future);
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":101}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.num_value").value(101));
        assertThat(rows.get(2).getDescription()).isEqualTo("복사할 내부 설명");
    }

    @Test
    void missingUpdateKeyIs404AndDoesNotWrite() throws Exception {
        mvc.perform(put("/api/admin/params/{key}", "MISSING")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":11}"))
            .andExpect(status().isNotFound());
        assertNoWrites();
    }

    @Test
    void longAuditKeyIsReadableButWriteRejectedAtomically() throws Exception {
        String key = "K".repeat(50);
        rows.add(row(key, "2000-01", "1"));
        mvc.perform(get("/api/admin/params/{key}/history", key)).andExpect(status().isOk());
        mvc.perform(put("/api/admin/params/{key}", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":11}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("key"));
        assertNoWrites();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
        {"num_value":11}|effective_from
        {"effective_from":"2026-13","num_value":11}|effective_from
        {"effective_from":"2026-11"}|num_value
        {"effective_from":"2026-11","num_value":null}|num_value
        {"effective_from":"2026-11","num_value":11,"text_value":"x"}|text_value
        {"effective_from":"2026-11","text_value":"x"}|num_value
        {"effective_from":"2026-11","num_value":100000000000000}|num_value
        {"effective_from":"2026-11","num_value":0.00001}|num_value
        {"effective_from":"2026-11","num_value":"11"}|num_value
        {"effective_from":"2026-11","num_value":11,"unknown":true}|unknown
        {|body
        """)
    void invalidInputKeepsPersistenceUnchanged(String body, String field) throws Exception {
        bad(body, field);
    }

    @Test
    void numericBoundaryPreservesAllDigitsWithoutDoubleRounding() throws Exception {
        mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":99999999999999.9999}"))
            .andExpect(status().isOk());
        assertThat(rows.get(1).getNumValue()).isEqualByComparingTo("99999999999999.9999");
    }

    @Test
    void textValueCanChangeButCannotSwitchToNumericType() throws Exception {
        ParamItem text = row("TEXT", "2000-01", null);
        text.setTextValue("이전");
        rows.add(text);
        mvc.perform(put("/api/admin/params/{key}", "TEXT")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"text_value\":\"새 값\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.text_value").value("새 값"));
        clearInvocations(mapper, history);
        mvc.perform(put("/api/admin/params/{key}", "TEXT")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"num_value\":1}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("text_value"));
        assertNoWrites();
    }

    @Test
    void oversizedTextRejectedWithoutWrites() throws Exception {
        ParamItem text = row("TEXT", "2000-01", null);
        text.setTextValue("이전");
        rows.add(text);
        mvc.perform(put("/api/admin/params/{key}", "TEXT")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"effective_from\":\"2026-11\",\"text_value\":\"" + "가".repeat(201) + "\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("text_value"));
        assertNoWrites();
    }

    @Test
    void persistenceErrorDoesNotExposeSqlOrSecrets() throws Exception {
        when(mapper.selectAll()).thenThrow(new IllegalStateException("SQL password secret"));
        var result = mvc.perform(get("/api/admin/params"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("SQL", "password", "secret");
    }

    @Test
    void durableFixtureDeclaresAllThreeExecutedPublicOperations() throws Exception {
        Map<?, ?> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        Map<?, ?> paths = (Map<?, ?>) document.get("paths");
        assertOperation(paths, "/api/admin/params", "get", "getAdminParams");
        assertOperation(paths, "/api/admin/params/{key}", "put", "updateParam");
        assertOperation(paths, "/api/admin/params/{key}/history", "get", "getParamHistory");
        mvc.perform(get("/api/admin/params")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/params/{key}/history", "VAT_RATE")).andExpect(status().isOk());
    }

    private void assertOperation(Map<?, ?> paths, String path, String method, String id) {
        Map<?, ?> operation = (Map<?, ?>) ((Map<?, ?>) paths.get(path)).get(method);
        assertThat(operation.get("operationId")).isEqualTo(id);
        assertThat((List<?>) operation.get("security")).isEmpty();
    }

    private void bad(String body, String field) throws Exception {
        var result = mvc.perform(put("/api/admin/params/{key}", "VAT_RATE")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field))
            .andExpect(jsonPath("$.code").value("400")).andReturn();
        var json = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.getResponse().getContentAsString());
        assertThat(json.get("requestId").asText()).isEqualTo(result.getResponse().getHeader("X-Request-Id"));
        assertNoWrites();
        assertThat(rows.get(0).getNumValue()).isEqualByComparingTo("10");
    }

    private void assertNoWrites() {
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateValues(any());
        verifyNoInteractions(history);
    }
}
