package cost.shared.monthclose;

import cost.common.ApiException;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 저장된 월 상태와 없는 월의 OPEN 투영을 읽기 전용으로 제공한다. */
@Service
public class MonthCloseService {
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("uuuu-MM");
    private final MonthCloseReadAdapter adapter;

    public MonthCloseService(MonthCloseReadAdapter adapter) {
        this.adapter = adapter;
    }

    /** 4자리 연도 전체를 허용하며 양끝 포함 조회에서 누락 월을 저장하지 않는다. */
    @Transactional(readOnly = true)
    public List<MonthCloseItem> getMonthClose(String from, String to) {
        YearMonth start = parse(from, "from");
        YearMonth end = parse(to, "to");
        if (end.isBefore(start)) {
            throw new ApiException(400, "종료 월을 확인해 주세요.", "to");
        }
        Map<String, String> states = new HashMap<>();
        for (MonthCloseRow row : adapter.read(from, to)) {
            if (!"OPEN".equals(row.getStatus()) && !"CLOSED".equals(row.getStatus())) {
                throw new IllegalStateException("Invalid stored month status");
            }
            states.put(row.getCloseMonth(), row.getStatus());
        }
        List<MonthCloseItem> result = new ArrayList<>();
        for (YearMonth month = start; !month.isAfter(end); month = month.plusMonths(1)) {
            String key = MONTH.format(month);
            result.add(new MonthCloseItem(key, states.getOrDefault(key, "OPEN")));
        }
        return result;
    }

    private YearMonth parse(String value, String field) {
        if (value == null || !value.matches("^[0-9]{4}-(0[1-9]|1[0-2])$")) {
            throw new ApiException(400, "연월을 확인해 주세요.", field);
        }
        return YearMonth.parse(value, MONTH);
    }
}
