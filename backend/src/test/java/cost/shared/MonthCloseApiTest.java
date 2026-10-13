package cost.shared;

import cost.common.ApiExceptionHandler;
import cost.common.RequestIdFilter;
import cost.shared.monthclose.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

@WebMvcTest(MonthCloseController.class)
@Import({MonthCloseService.class, MonthCloseReadAdapter.class, RequestIdFilter.class, ApiExceptionHandler.class})
class MonthCloseApiTest {
    @Autowired
    MockMvc mvc;
    @MockBean
    MonthCloseMapper mapper;

    MonthCloseRow row(String month, String status) {
        MonthCloseRow row = new MonthCloseRow();
        row.setCloseMonth(month);
        row.setStatus(status);
        return row;
    }

    @Test
    void anonymousInclusiveRangeReadsClosedAndOpenWithoutMutation() throws Exception {
        var closed = row("2026-09", "CLOSED");
        var open = row("2026-10", "OPEN");
        when(mapper.selectRange("2026-09", "2026-10")).thenReturn(List.of(closed, open));
        mvc.perform(get("/api/month-close").param("from", "2026-09").param("to", "2026-10"))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-Request-Id"))
            .andExpect(content().json("""
                {"success":true,"meta":{},"data":[
                  {"close_month":"2026-09","status":"CLOSED"},
                  {"close_month":"2026-10","status":"OPEN"}]}
                """, true));
        assertThat(closed.getStatus()).isEqualTo("CLOSED");
        assertThat(open.getStatus()).isEqualTo("OPEN");
        verify(mapper).selectRange("2026-09", "2026-10");
        verifyNoMoreInteractions(mapper);
    }

    @Test
    void missingMonthIsProjectedAsOpenAndNoWriteAdapterExists() throws Exception {
        when(mapper.selectRange("2027-01", "2027-01")).thenReturn(List.of());
        mvc.perform(get("/api/month-close").param("from", "2027-01").param("to", "2027-01"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].status").value("OPEN"));
        verify(mapper).selectRange("2027-01", "2027-01");
        verifyNoMoreInteractions(mapper);
    }

    @ParameterizedTest
    @CsvSource({"0000-01,0000-01", "9999-12,9999-12", "2025-12,2026-01"})
    void fullFourDigitYearRangeAndYearCrossingAreAllowed(String from, String to) throws Exception {
        when(mapper.selectRange(from, to)).thenReturn(List.of());
        mvc.perform(get("/api/month-close").param("from", from).param("to", to))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].close_month").value(from));
    }

    @Test
    void missingFromIsFieldErrorBeforePersistence() throws Exception {
        mvc.perform(get("/api/month-close").param("to", "2026-10"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("from"));
        verifyNoInteractions(mapper);
    }

    @Test
    void missingToIsFieldErrorBeforePersistence() throws Exception {
        mvc.perform(get("/api/month-close").param("from", "2026-09"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("to"));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @CsvSource({"2026-00,2026-10,from", "2026-09,2026-13,to", "2026-9,2026-10,from",
        "2026-09,abcd-10,to", "2026-10,2026-09,to"})
    void malformedOrReversedRangeHasMatchingErrorIdAndNoQuery(String from, String to, String field)
        throws Exception {
        var result = mvc.perform(get("/api/month-close").param("from", from).param("to", to))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("400"))
            .andExpect(jsonPath("$.field").value(field))
            .andReturn();
        var body = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(result.getResponse().getContentAsString());
        assertThat(body.get("requestId").asText()).isEqualTo(result.getResponse().getHeader("X-Request-Id"));
        verifyNoInteractions(mapper);
    }

    @Test
    void nullStoredStatusFailsSafelyRatherThanPretendingOpen() throws Exception {
        when(mapper.selectRange("2026-09", "2026-09")).thenReturn(List.of(row("2026-09", null)));
        mvc.perform(get("/api/month-close").param("from", "2026-09").param("to", "2026-09"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("500"))
            .andExpect(jsonPath("$.field").isEmpty())
            .andExpect(jsonPath("$.message").value("처리 중 오류가 발생했습니다. 다시 시도해 주세요."));
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableContractMatchesTheExecutedPublicOperation() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var paths = (Map<String, Object>) document.get("paths");
        var operation = (Map<String, Object>) ((Map<?, ?>) paths.get("/api/month-close")).get("get");
        assertThat(operation.get("operationId")).isEqualTo("getMonthClose");
        assertThat((List<?>) operation.get("security")).isEmpty();
        when(mapper.selectRange("2026-09", "2026-10")).thenReturn(List.of());
        mvc.perform(get("/api/month-close").param("from", "2026-09").param("to", "2026-10"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2));
    }
}
