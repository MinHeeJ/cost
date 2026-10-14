package cost.excelmappings;

import java.util.List;
import org.springframework.stereotype.Repository;

/** 서비스 트랜잭션에 참여하는 MyBatis 읽기·쓰기 경계. */
@Repository
public class ExcelMappingAdapter {
    private final ExcelMappingMapper mapper;

    public ExcelMappingAdapter(ExcelMappingMapper mapper) {
        this.mapper = mapper;
    }

    public List<ExcelMapping> read() {
        return mapper.selectAll();
    }

    public ExcelMapping find(String label, String group, String code) {
        return mapper.selectOne(label, group, code);
    }

    public boolean lockCode(String group, String code) {
        return mapper.lockCode(group, code) != null;
    }

    public boolean lockMapping(String label, String group, String code) {
        return mapper.lockMapping(label, group, code) != null;
    }

    public void insert(ExcelMapping row, Long actor) {
        if (mapper.insert(row, actor) != 1) {
            throw new IllegalStateException("Mapping insert failed");
        }
    }

    public void update(ExcelMapping row) {
        if (mapper.update(row) != 1) {
            throw new IllegalStateException("Mapping update failed");
        }
    }
}
