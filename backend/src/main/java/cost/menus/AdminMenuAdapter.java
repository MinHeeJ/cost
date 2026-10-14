package cost.menus;

import java.util.List;
import org.springframework.stereotype.Repository;

/** Spring/MyBatis 동일 DataSource 트랜잭션을 사용하는 메뉴 영속성 어댑터. */
@Repository
public class AdminMenuAdapter {
    private final AdminMenuMapper mapper;

    public AdminMenuAdapter(AdminMenuMapper mapper) {
        this.mapper = mapper;
    }

    public List<AdminMenuRow> read() {
        return mapper.selectAll();
    }

    public void lockRoots() {
        mapper.lockRoots();
    }

    public void update(AdminMenuRow row) {
        if (mapper.update(row) != 1) {
            throw new IllegalStateException("Menu disappeared during locked update");
        }
    }

    public void insert(AdminMenuRow row) {
        if (mapper.insert(row) != 1 || row.getMenuId() == null) {
            throw new IllegalStateException("Menu insert did not return its generated key");
        }
    }

    public void insertScreenPermissions(Long menuId) {
        mapper.insertScreenPermissions(menuId);
    }
}
