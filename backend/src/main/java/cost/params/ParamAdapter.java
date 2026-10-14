package cost.params;

import java.util.List;
import org.springframework.stereotype.Repository;

/** Spring 관리 MyBatis 세션으로 읽기와 값 쓰기를 같은 서비스 transaction에 참여시킨다. */
@Repository
public class ParamAdapter {
    private final ParamMapper mapper;

    public ParamAdapter(ParamMapper mapper) {
        this.mapper = mapper;
    }

    public List<ParamItem> readAll() {
        return mapper.selectAll();
    }

    public List<ParamItem> history(String key) {
        return mapper.selectHistory(key);
    }

    public List<ParamItem> lock(String key) {
        return mapper.lockHistory(key);
    }

    public String lastClosed() {
        return mapper.selectLastClosed();
    }

    public void save(ParamItem item, boolean existing) {
        int count = existing ? mapper.updateValues(item) : mapper.insert(item);
        if (count != 1) {
            throw new IllegalStateException("Param write failed");
        }
    }
}
