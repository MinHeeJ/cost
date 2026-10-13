package cost.shared.monthclose;

import java.util.List;
import org.springframework.stereotype.Repository;

/** 서비스가 persistence 기술에 직접 의존하지 않도록 읽기를 위임한다. */
@Repository
public class MonthCloseReadAdapter {
    private final MonthCloseMapper mapper;

    public MonthCloseReadAdapter(MonthCloseMapper mapper) {
        this.mapper = mapper;
    }

    public List<MonthCloseRow> read(String from, String to) {
        return mapper.selectRange(from, to);
    }
}
