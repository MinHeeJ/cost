package cost.shared.monthclose;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 조회 월과 상태만 공개하며 마감·재개 감사 정보는 내부에 보존한다. */
public class MonthCloseItem {
    private final String closeMonth;
    private final String status;

    public MonthCloseItem(String closeMonth, String status) {
        this.closeMonth = closeMonth;
        this.status = status;
    }

    @JsonProperty("close_month")
    public String getCloseMonth() {
        return closeMonth;
    }

    public String getStatus() {
        return status;
    }
}
