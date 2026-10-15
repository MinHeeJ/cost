package cost.params;

import cost.common.ApiException;
import cost.common.CodeHistoryWriter;
import cost.common.CurrentUser;
import cost.common.DataScope;
import cost.common.PermissionService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 적용월 선택, 마감 경계와 자료형 보존을 원본·항목 이력의 단일 transaction으로 보장한다. */
@Service
public class ParamService {
    private final ParamAdapter adapter;
    private final CodeHistoryWriter historyWriter;
    private final CurrentUser currentUser;
    private final PermissionService permission;
    private final Clock clock;

    public ParamService(
        ParamAdapter adapter,
        CodeHistoryWriter historyWriter,
        CurrentUser currentUser,
        PermissionService permission,
        @Qualifier("paramsClock") Clock clock
    ) {
        this.adapter = adapter;
        this.historyWriter = historyWriter;
        this.currentUser = currentUser;
        this.permission = permission;
        this.clock = clock;
    }

    /** 오늘 이하 key별 최신행만 투영하며 미래행과 모든 감사 자료는 변경하지 않는다. */
    @Transactional(readOnly = true)
    public List<ParamItem> getAdminParams(DataScope scope) {
        requirePermission("UI-27.read");
        String today = YearMonth.now(clock.withZone(ZoneId.of("Asia/Seoul"))).toString();
        Map<String, ParamItem> current = new TreeMap<>();
        for (ParamItem item : adapter.readAll()) {
            if (item.getEffectiveFrom().compareTo(today) <= 0) {
                ParamItem previous = current.get(item.getParamKey());
                if (previous == null || previous.getEffectiveFrom().compareTo(item.getEffectiveFrom()) < 0) {
                    current.put(item.getParamKey(), item);
                }
            }
        }
        return List.copyOf(current.values());
    }

    /** 미래행까지 포함한 전체 적용월을 D11에 따라 페이지 분할 없이 반환한다. */
    @Transactional(readOnly = true)
    public List<ParamItem> getParamHistory(String key, DataScope scope) {
        requirePermission("UI-27.read");
        List<ParamItem> rows = adapter.history(key);
        if (rows.isEmpty()) {
            throw new ApiException(404, "없는 기준값", null);
        }
        return rows.stream().sorted(Comparator.comparing(ParamItem::getEffectiveFrom).reversed()).toList();
    }

    /** 기존 key만 저장한다. 행 잠금 후 전역 마감 경계 검증과 항목 이력을 함께 커밋한다. */
    @Transactional
    public ParamItem updateParam(String key, UpdateParamRequest request) {
        requirePermission("UI-27.update");
        String month = request.getEffectiveFrom();
        if (month == null || !month.matches("^[0-9]{4}-(0[1-9]|1[0-2])$")) {
            invalid("effective_from");
        }
        if (key.codePointCount(0, key.length()) > 30) {
            invalid("key");
        }
        List<ParamItem> rows = adapter.lock(key);
        if (rows.isEmpty()) {
            throw new ApiException(404, "없는 기준값", null);
        }
        String closed = adapter.lastClosed();
        if (closed != null && month.compareTo(closed) <= 0) {
            invalid("effective_from");
        }
        ParamItem source = rows.stream()
            .filter(row -> row.getEffectiveFrom().compareTo(month) <= 0)
            .max(Comparator.comparing(ParamItem::getEffectiveFrom))
            .orElseGet(() -> rows.stream().min(Comparator.comparing(ParamItem::getEffectiveFrom)).orElseThrow());
        ParamItem existing = rows.stream()
            .filter(row -> row.getEffectiveFrom().equals(month)).findFirst().orElse(null);
        validateValue(source, request);
        ParamItem next = copy(source, month);
        if (request.hasNumValue()) {
            next.setNumValue(request.getNumValue());
        }
        if (request.hasTextValue()) {
            next.setTextValue(request.getTextValue());
        }
        // Numeric equality ignores database scale so resaving 10/10.0000 is a true no-op.
        Map<String, Object> before = existing == null ? null : values(existing);
        Map<String, Object> after = values(next);
        if (existing != null && before.equals(after)) {
            return existing;
        }
        adapter.save(next, existing != null);
        historyWriter.recordChanges("PARAM", key, before, after);
        return next;
    }

    private void validateValue(ParamItem source, UpdateParamRequest request) {
        BigDecimal number = request.getNumValue();
        String text = request.getTextValue();
        if (number != null && text != null) {
            invalid("text_value");
        }
        if (number == null && text == null) {
            invalid(source.getNumValue() != null ? "num_value" : "text_value");
        }
        if (source.getNumValue() != null) {
            if (number == null || text != null) {
                invalid("num_value");
            }
        } else if (text == null || number != null) {
            invalid("text_value");
        }
        if (number != null) {
            BigDecimal normalized = number.stripTrailingZeros();
            if (normalized.scale() > 4 || normalized.precision() - normalized.scale() > 14) {
                invalid("num_value");
            }
        }
        if (text != null && text.codePointCount(0, text.length()) > 200) {
            invalid("text_value");
        }
    }

    private ParamItem copy(ParamItem source, String month) {
        ParamItem next = new ParamItem();
        next.setParamKey(source.getParamKey());
        next.setEffectiveFrom(month);
        next.setParamName(source.getParamName());
        next.setNumValue(source.getNumValue());
        next.setTextValue(source.getTextValue());
        next.setUnit(source.getUnit());
        next.setUsedIn(source.getUsedIn());
        next.setDescription(source.getDescription());
        next.setCreatedBy(currentUser.getUserId());
        return next;
    }

    private Map<String, Object> values(ParamItem item) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("num_value", item.getNumValue() == null
            ? null : item.getNumValue().stripTrailingZeros().toPlainString());
        values.put("text_value", item.getTextValue());
        return values;
    }

    private void requirePermission(String key) {
        if (!permission.can(key)) {
            throw new ApiException(403, "허용되지 않은 기능", null);
        }
    }

    private void invalid(String field) {
        throw new ApiException(400, "입력값 확인", field);
    }
}
