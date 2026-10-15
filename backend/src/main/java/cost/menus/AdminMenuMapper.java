package cost.menus;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;

/** 스키마를 명시한 메뉴 쿼리와 같은 트랜잭션의 역할 권한 INSERT 경계. */
@Mapper
public interface AdminMenuMapper {
    List<AdminMenuRow> selectAll();
    List<Long> lockRoots();
    int update(AdminMenuRow row);
    int insert(AdminMenuRow row);
    int insertScreenPermissions(Long menuId);
}
