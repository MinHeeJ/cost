package cost.shared.monthclose;

/** 기존 기반 테이블 SELECT 결과를 XML resultMap으로 수용하는 행 모델. */
public class MonthCloseRow {
    private String closeMonth;
    private String status;

    public String getCloseMonth() {
        return closeMonth;
    }

    public void setCloseMonth(String value) {
        this.closeMonth = value;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String value) {
        this.status = value;
    }
}
