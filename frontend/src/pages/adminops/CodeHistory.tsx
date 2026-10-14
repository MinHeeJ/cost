import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "../../app/api-client";
import ActorName from "../../components/ActorName";
import Can from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import SensitiveCell, {
  type SensitiveColumn,
} from "../../components/SensitiveCell";
import shared from "../shared/Workspace.module.css";
import styles from "./CodeHistory.module.css";
import {
  getCodeHistory,
  getCodeHistoryGroups,
  type CodeHistoryGroup,
  type CodeHistoryItem,
  type CodeHistoryPage,
  type CodeHistoryQuery,
} from "./api";

const actionNames: Record<CodeHistoryItem["action"], string> = {
  ADD: "추가",
  UPDATE: "수정",
  DISABLE: "사용 중지",
  ENABLE: "다시 사용",
};
const columns: SensitiveColumn[] = [
  { key: "changed_at", label: "일시" },
  { key: "group_name", label: "그룹" },
  { key: "code", label: "코드" },
  { key: "action", label: "구분" },
  { key: "field_name", label: "항목" },
  { key: "before_value", label: "이전", sensitive: true },
  { key: "after_value", label: "이후", sensitive: true },
  { key: "changed_by", label: "변경자" },
];
const asError = (cause: unknown) =>
  cause instanceof Error ? cause : new Error("처리 중 오류가 발생했습니다.");

export interface CodeHistoryProps {
  /** 다른 UI-27 탭의 저장 완료 후 부모가 증가시키면 현재 필터/페이지로 재조회한다. */
  refreshToken?: number;
}

/** UI-27의 readonly 이력 탭. 공유 shell 소유자가 hidden으로 유지해 탐색 상태를 보존한다. */
export default function CodeHistory({ refreshToken = 0 }: CodeHistoryProps) {
  const [query, setQuery] = useState<CodeHistoryQuery>({ page: 1, size: 50 });
  const [result, setResult] = useState<CodeHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [groups, setGroups] = useState<CodeHistoryGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<Error | null>(null);
  const [groupsRetry, setGroupsRetry] = useState(0);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    getCodeHistory(query, controller.signal)
      .then((response) => {
        if (!response.data) throw new Error("서버 응답을 확인할 수 없습니다.");
        if (active) setResult(response.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(asError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, retry, refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setGroupsLoading(true);
    setGroupsError(null);
    getCodeHistoryGroups(controller.signal)
      .then((response) => {
        if (active) setGroups(response.data ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setGroupsError(asError(cause));
      })
      .finally(() => {
        if (active) setGroupsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [groupsRetry]);

  useEffect(() => {
    if (error instanceof ApiClientError && error.field) {
      panel.current
        ?.querySelector<HTMLElement>(`[name="${error.field}"]`)
        ?.focus();
    }
  }, [error]);

  return (
    <Can perm="UI-27.read">
      <section
        ref={panel}
        className={shared.card}
        data-testid="code-history-panel"
        aria-label="변경 이력"
        aria-busy={loading}
      >
        <h2>변경 이력</h2>
        <div className={shared.row}>
          <label htmlFor="code-history-group">그룹</label>
          <select
            id="code-history-group"
            name="group"
            aria-label="이력 그룹"
            data-testid="H-GOPTIONS"
            value={query.group ?? ""}
            disabled={groupsLoading}
            aria-invalid={
              error instanceof ApiClientError && error.field === "group"
            }
            onChange={(event) =>
              setQuery({
                ...query,
                group: event.target.value || undefined,
                page: 1,
              })
            }
          >
            <option value="">전체</option>
            {groups
              .filter((group) => group.group_code !== "PARAM")
              .map((group) => (
                <option key={group.group_code} value={group.group_code}>
                  {group.group_name}
                </option>
              ))}
            <option value="PARAM">기준값</option>
          </select>
          {groupsLoading && <span role="status">그룹을 불러오는 중…</span>}
        </div>
        <ErrorBanner
          error={groupsError}
          onRetry={() => setGroupsRetry((value) => value + 1)}
          retrying={groupsLoading}
        />
        <ErrorBanner
          error={error}
          onRetry={() => setRetry((value) => value + 1)}
          retrying={loading}
        />
        {loading && (
          <p role="status" data-testid="code-history-loading">
            이력을 불러오는 중…
          </p>
        )}
        {!loading && !error && result && (
          <>
            {result.items.length === 0 ? (
              <p data-testid="code-history-empty">
                해당 그룹의 변경 이력이 없습니다.
              </p>
            ) : (
              <div className={shared.tableScroll}>
                <table className={styles.table} aria-label="항목별 변경 이력">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item, index) => (
                      <tr key={index} data-testid={`code-history-row-${index}`}>
                        <td>{item.changed_at.replace("T", " ")}</td>
                        <td title={item.group_code}>{item.group_name}</td>
                        <td title={item.code ?? undefined}>
                          {item.code ?? "—"}
                        </td>
                        <td title={item.action}>{actionNames[item.action]}</td>
                        <td>{item.field_name}</td>
                        <td>
                          <SensitiveCell sensitive>
                            {item.before_value ?? "—"}
                          </SensitiveCell>
                        </td>
                        <td>
                          <SensitiveCell sensitive>
                            {item.after_value ?? "—"}
                          </SensitiveCell>
                        </td>
                        <td>
                          <ActorName actor={item.changed_by} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p data-testid="code-history-total">
              전체 {result.total}건 · 최신순
            </p>
          </>
        )}
        <nav className={shared.row} aria-label="이력 페이지">
          <button
            name="page"
            data-testid="code-history-previous"
            disabled={loading || query.page <= 1}
            onClick={() => setQuery({ ...query, page: query.page - 1 })}
          >
            이전
          </button>
          <span data-testid="code-history-page">{query.page}페이지</span>
          <button
            data-testid="code-history-next"
            disabled={
              loading ||
              !!error ||
              !result ||
              query.page * query.size >= result.total
            }
            onClick={() => setQuery({ ...query, page: query.page + 1 })}
          >
            다음
          </button>
          <label htmlFor="code-history-size">페이지 크기</label>
          <select
            id="code-history-size"
            name="size"
            aria-label="이력 페이지 크기"
            data-testid="code-history-size"
            value={query.size}
            aria-invalid={
              error instanceof ApiClientError && error.field === "size"
            }
            onChange={(event) =>
              setQuery({
                ...query,
                size: Number(event.target.value) as 20 | 50 | 100,
                page: 1,
              })
            }
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <button
            data-testid="code-history-reload"
            disabled={loading}
            onClick={() => setRetry((value) => value + 1)}
          >
            새로고침
          </button>
        </nav>
      </section>
    </Can>
  );
}
