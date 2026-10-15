package cost.adminops;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 기존 si_cost 감사 자산에 대해 쓰기 없이 목록과 전체 건수를 조회한다. */
@Mapper
public interface CodeHistoryMapper {
    /** 최신순과 hist_id 동률 정렬을 적용한 부분 집합. */
    List<CodeHistoryItem> selectPage(
        @Param("group") String group,
        @Param("pageLimit") int pageLimit,
        @Param("pageOffset") long pageOffset
    );

    /** 목록과 같은 선택 조건의 전체 건수. */
    long count(@Param("group") String group);
}
