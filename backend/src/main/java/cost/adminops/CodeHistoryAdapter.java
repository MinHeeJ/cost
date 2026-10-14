package cost.adminops;

import java.util.List;
import org.springframework.stereotype.Repository;

/** 이력 조회 persistence 경계. 정수 offset을 미리 계산하여 XML에는 값만 바인딩한다. */
@Repository
public class CodeHistoryAdapter {
    private final CodeHistoryMapper mapper;

    public CodeHistoryAdapter(CodeHistoryMapper mapper) {
        this.mapper = mapper;
    }

    public List<CodeHistoryItem> read(String group, int size, long pageOffset) {
        return mapper.selectPage(group, size, pageOffset);
    }

    public long count(String group) {
        return mapper.count(group);
    }
}
