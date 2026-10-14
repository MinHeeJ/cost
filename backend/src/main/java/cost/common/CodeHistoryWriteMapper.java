package cost.common;

import org.apache.ibatis.annotations.Mapper;

/** 기존 si_cost.cm_code_history에만 기록하는 공통 XML 쓰기 mapper. */
@Mapper
public interface CodeHistoryWriteMapper {
    /** 호출자의 업무 트랜잭션에 참여하며 DB가 changed_at과 hist_id를 생성한다. */
    int insert(CodeHistoryEntry entry);
}
