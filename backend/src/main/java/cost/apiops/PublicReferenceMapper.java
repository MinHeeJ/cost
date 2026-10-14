package cost.apiops;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 기존 si_cost 자산을 읽기만 하는 XML mapper. */
@Mapper
public interface PublicReferenceMapper {
    boolean groupExists(@Param("group") String group);
    List<CodeOption> selectCodes(@Param("group") String group);
    ParamItem selectParam(@Param("key") String key, @Param("month") String month);
}
