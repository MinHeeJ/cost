package cost.apiops;

import java.util.List;
import org.springframework.stereotype.Repository;

/** 공개 조회 서비스의 persistence 경계이며 쓰기 메서드를 제공하지 않는다. */
@Repository
public class PublicReferenceAdapter {
    private final PublicReferenceMapper mapper;

    public PublicReferenceAdapter(PublicReferenceMapper mapper) {
        this.mapper = mapper;
    }

    public boolean groupExists(String group) {
        return mapper.groupExists(group);
    }

    public List<CodeOption> codes(String group) {
        return mapper.selectCodes(group);
    }

    public ParamItem param(String key, String month) {
        return mapper.selectParam(key, month);
    }
}
