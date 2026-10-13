package cost.shared.menu;

import java.util.List;
import org.springframework.stereotype.Repository;

/** 서비스가 persistence 기술에 직접 의존하지 않도록 읽기를 위임한다. */
@Repository
public class MenuReadAdapter {
    private final MenuMapper mapper;

    public MenuReadAdapter(MenuMapper mapper) {
        this.mapper = mapper;
    }

    public List<MenuRow> read() {
        return mapper.selectActive();
    }
}
