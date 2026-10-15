package cost.adminops;

import java.util.List;

/** 필터 전체 건수와 현재 페이지를 하나의 data 객체로 제공한다. */
public class CodeHistoryPage {
    private final List<CodeHistoryItem> items;
    private final long total;
    private final int page;
    private final int size;

    public CodeHistoryPage(List<CodeHistoryItem> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<CodeHistoryItem> getItems() {
        return items;
    }

    public long getTotal() {
        return total;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
