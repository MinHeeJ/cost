import { useEffect, useState } from "react";
import { getMonthClose } from "./api";
import { currentPeriod, monthKey, usePeriods, type Period } from "./periods";
import type { PeriodType } from "./registry";
import ErrorBanner from "../../components/ErrorBanner";
import Icon from "../../components/Icon";
import styles from "./Workspace.module.css";

export function PeriodBar({
  screenId,
  type,
}: {
  screenId: string;
  type: PeriodType;
}) {
  const remembered = usePeriods((state) => state.periods[screenId]);
  const setPeriod = usePeriods((state) => state.setPeriod);
  const [initial] = useState(currentPeriod);
  const period = remembered ?? initial;
  const key = monthKey(period);
  const [status, setStatus] = useState<"OPEN" | "CLOSED" | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (type !== "MONTH") return;
    const abort = new AbortController();
    setStatus(null);
    setError(null);
    setLoading(true);
    setDismissed(false);
    getMonthClose(key, key, abort.signal)
      .then((response) => {
        if (!abort.signal.aborted)
          setStatus(response.data?.[0]?.status ?? null);
      })
      .catch((failure: Error) => {
        if (!abort.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [key, retry, type]);
  if (type === "NONE") return null;
  function change(next: Period) {
    if (
      next.year >= 0 &&
      next.year <= 9999 &&
      next.month >= 1 &&
      next.month <= 12
    )
      setPeriod(screenId, next);
  }
  function move(direction: number) {
    if (type !== "MONTH") change({ ...period, year: period.year + direction });
    else {
      const absolute = period.year * 12 + period.month - 1 + direction;
      change({ year: Math.floor(absolute / 12), month: (absolute % 12) + 1 });
    }
  }
  return (
    <section aria-label="화면 기간" className={styles.period}>
      <div className={styles.row}>
        <button type="button" aria-label="이전 기간" onClick={() => move(-1)}>
          <Icon name="left" />
        </button>
        <label>
          {type === "MONTH" ? "연월" : "연도"}
          {type === "MONTH" ? (
            <input
              type="month"
              aria-label="연월"
              value={key}
              onChange={(event) => {
                if (/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
                  const [year, month] = event.target.value
                    .split("-")
                    .map(Number);
                  change({ year, month });
                }
              }}
            />
          ) : (
            <input
              type="number"
              aria-label="연도"
              min="0"
              max="9999"
              value={period.year}
              onChange={(event) =>
                change({ ...period, year: Number(event.target.value) })
              }
            />
          )}
        </label>
        <button type="button" aria-label="다음 기간" onClick={() => move(1)}>
          <Icon name="right" />
        </button>
        {type === "YEAR_CUM" && (
          <>
            <label>
              월
              <select
                aria-label="누계 종료 월"
                value={period.month}
                onChange={(event) =>
                  change({ ...period, month: Number(event.target.value) })
                }
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}월
                  </option>
                ))}
              </select>
            </label>
            <span>1월 ~ {period.month}월 누계</span>
          </>
        )}
        {loading && <span role="status">마감 상태 읽는 중…</span>}
        {status && (
          <span
            className={status === "CLOSED" ? styles.locked : styles.success}
          >
            {status === "CLOSED" ? "마감" : "작업중"}
          </span>
        )}
      </div>
      {type === "MONTH" && !loading && !error && !status && (
        <div role="status" className={styles.skeleton}>
          <p>선택한 월의 마감 상태가 없습니다.</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            마감 상태 다시 읽기
          </button>
        </div>
      )}
      {status === "CLOSED" && (
        <p className={styles.locked}>
          마감된 달입니다. 수정·삭제할 수 없습니다.
        </p>
      )}
      {status === "CLOSED" && !dismissed && (
        <div className={styles.warning}>
          <p>마감 상태를 확인해 주세요.</p>
          <button type="button" onClick={() => setDismissed(true)}>
            확인했음
          </button>
        </div>
      )}
      <ErrorBanner
        error={error}
        retrying={loading}
        onRetry={() => setRetry((value) => value + 1)}
      />
    </section>
  );
}
