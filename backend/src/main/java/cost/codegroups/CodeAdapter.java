package cost.codegroups;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

/** MyBatis 호출을 서비스 트랜잭션에 참여시키는 영속성 어댑터. */
@Repository
public class CodeAdapter {
    private final CodeMapper mapper;

    public CodeAdapter(CodeMapper mapper) {
        this.mapper = mapper;
    }

    public List<CodeGroup> groups() {
        return mapper.selectGroups();
    }

    public CodeGroup group(String group, boolean lock) {
        return lock ? mapper.lockGroup(group) : mapper.selectGroup(group);
    }

    public List<AdminCode> codes(String group) {
        return mapper.selectCodes(group);
    }

    public void addGroup(CodeGroup row, Long actor) {
        requireOne(mapper.insertGroup(row, actor));
    }

    public void addCode(AdminCode row, Long actor) {
        requireOne(mapper.insertCode(row, actor));
    }

    public void changeCode(String group, String code, Map<String, Object> changes, Long actor) {
        requireOne(mapper.updateCode(group, code, changes, actor));
    }

    private void requireOne(int count) {
        if (count != 1) {
            throw new IllegalStateException("Code write failed");
        }
    }
}
