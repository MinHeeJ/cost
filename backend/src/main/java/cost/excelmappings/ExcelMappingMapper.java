package cost.excelmappings;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 기존 대응과 코드 참조를 명시 스키마 XML로 읽고 저장한다. */
@Mapper
public interface ExcelMappingMapper {
    List<ExcelMapping> selectAll();

    ExcelMapping selectOne(
        @Param("label") String label,
        @Param("group") String group,
        @Param("code") String code
    );

    /** 생성은 참조 코드, 수정은 기존 대응을 잠가 중복 및 갱신 경쟁을 직렬화한다. */
    String lockCode(@Param("group") String group, @Param("code") String code);

    Long lockMapping(
        @Param("label") String label,
        @Param("group") String group,
        @Param("code") String code
    );

    int insert(@Param("row") ExcelMapping row, @Param("actor") Long actor);

    int update(@Param("row") ExcelMapping row);
}
