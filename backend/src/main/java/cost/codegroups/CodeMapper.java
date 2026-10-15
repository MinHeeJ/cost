package cost.codegroups;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** si_cost 기존 테이블의 공통코드 관리 XML SQL 경계. */
@Mapper
public interface CodeMapper {
    List<CodeGroup> selectGroups();
    CodeGroup selectGroup(@Param("group") String group);
    CodeGroup lockGroup(@Param("group") String group);
    List<AdminCode> selectCodes(@Param("group") String group);
    int insertGroup(@Param("row") CodeGroup row, @Param("actor") Long actor);
    int insertCode(@Param("row") AdminCode row, @Param("actor") Long actor);
    int updateCode(
        @Param("group") String group,
        @Param("code") String code,
        @Param("changes") Map<String, Object> changes,
        @Param("actor") Long actor
    );
}
