package cost.params;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 기존 cm_param 복합키 및 전역 마감월을 사용하는 XML persistence 경계. */
@Mapper
public interface ParamMapper {
    List<ParamItem> selectAll();

    List<ParamItem> selectHistory(@Param("key") String key);

    /** 같은 키의 기존 행을 적용월 순으로 잠가 동시에 새 월을 추가하지 않게 한다. */
    List<ParamItem> lockHistory(@Param("key") String key);

    String selectLastClosed();

    int insert(ParamItem item);

    int updateValues(ParamItem item);
}
