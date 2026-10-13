package cost.shared.menu;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** 기존 테이블의 공개 읽기만 제공하는 XML mapper. */
@Mapper
public interface MenuMapper {
    /** 범위와 활성 조건을 SQL에서 적용하며 저장 상태를 변경하지 않는다. */
    List<MenuRow> selectActive();
}
