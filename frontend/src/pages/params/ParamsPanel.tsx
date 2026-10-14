import { useEffect, useRef, useState, type FormEvent } from "react";
import Can from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import { ApiClientError } from "../../app/api-client";
import { useScreenTabs } from "../shared/tabs";
import shared from "../shared/Workspace.module.css";
import styles from "./Params.module.css";
import {
  getAdminParams,
  getLastClosedMonth,
  getParamHistory,
  updateParam,
  type ParamItem,
} from "./api";

export interface ParamsPanelProps {
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return value === 12
    ? `${String(year + 1).padStart(4, "0")}-01`
    : `${String(year).padStart(4, "0")}-${String(value + 1).padStart(2, "0")}`;
}

const displayValue = (item: ParamItem) =>
  String(item.num_value ?? item.text_value ?? "–");
const defaultDirty = (dirty: boolean) =>
  useScreenTabs.getState().setDirty("/UI-27", dirty);

/** UI-27 기준값 영역. 부모의 네 탭에서는 hidden 상태로 유지하여 작업창 초안을 보존한다. */
export function ParamsPanel({
  onDirtyChange = defaultDirty,
  onSaved,
}: ParamsPanelProps) {
  const [items, setItems] = useState<ParamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<ParamItem | null>(null);
  const [mode, setMode] = useState<"edit" | "history" | null>(null);
  const [history, setHistory] = useState<ParamItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [value, setValue] = useState("");
  const [month, setMonth] = useState("");
  const [lastClosed, setLastClosed] = useState<string | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState<Error | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const valueRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      setItems((await getAdminParams()).data ?? []);
    } catch (error) {
      setListError(error as Error);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function loadBoundary() {
    setBoundaryLoading(true);
    setBoundaryError(null);
    try {
      setLastClosed(await getLastClosedMonth());
    } catch (error) {
      setBoundaryError(error as Error);
    } finally {
      setBoundaryLoading(false);
    }
  }

  async function loadHistory(item: ParamItem) {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory((await getParamHistory(item.param_key)).data ?? []);
    } catch (error) {
      setHistoryError(error as Error);
    } finally {
      setHistoryLoading(false);
    }
  }

  function open(item: ParamItem, next: "edit" | "history") {
    setSelected(item);
    setMode(next);
    setSuccess("");
    setSaveError(null);
    setFieldErrors({});
    if (next === "edit") {
      setValue(displayValue(item));
      setMonth("");
      void loadBoundary();
    } else {
      setHistory([]);
      void loadHistory(item);
    }
  }

  function close() {
    setMode(null);
    setSelected(null);
    onDirtyChange(false);
  }

  useEffect(() => {
    if (mode === "edit") valueRef.current?.focus();
    if (mode === "history") closeRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== "edit" || busy) return;
    if (fieldErrors.effective_from) monthRef.current?.focus();
    else if (fieldErrors.num_value || fieldErrors.text_value || fieldErrors.key)
      valueRef.current?.focus();
  }, [fieldErrors, busy, mode]);

  function validate() {
    const errors: Record<string, string> = {};
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      errors.effective_from = "적용 시작월을 YYYY-MM 형식으로 입력해 주세요.";
    } else if (lastClosed !== null && month <= lastClosed) {
      errors.effective_from = "마지막 마감월의 다음 달부터 저장할 수 있습니다.";
    }
    if (selected?.num_value !== null) {
      if (!/^-?\d{1,14}(?:\.\d{1,4})?$/.test(value)) {
        errors.num_value =
          "숫자는 정수 14자리·소수 4자리 이내로 입력해 주세요.";
      }
    } else if ([...value].length > 200) {
      errors.text_value = "문자는 200자 이내로 입력해 주세요.";
    }
    setFieldErrors(errors);
    if (errors.num_value || errors.text_value) valueRef.current?.focus();
    else if (errors.effective_from) monthRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!selected || busy || boundaryLoading || boundaryError || !validate())
      return;
    setBusy(true);
    setSaveError(null);
    try {
      await updateParam(
        selected.param_key,
        selected.num_value !== null
          ? { effective_from: month, num_value: value }
          : { effective_from: month, text_value: value },
      );
      close();
      setSuccess("기준값을 저장했습니다.");
      onSaved?.();
      await load();
    } catch (error) {
      setSaveError(error as Error);
      if (error instanceof ApiClientError && error.field) {
        setFieldErrors({ [error.field]: error.message });
        if (error.field === "effective_from") monthRef.current?.focus();
        else valueRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  const valueField = selected?.num_value !== null ? "num_value" : "text_value";
  return (
    <section
      className={shared.page}
      data-testid="params-panel"
      aria-label="기준값"
    >
      <h2>기준값</h2>
      <p>
        오늘 연월 이하의 최신 기준값을 표시합니다. 미래 적용값은 이력에서 확인할
        수 있습니다.
      </p>
      <ErrorBanner
        error={listError}
        onRetry={() => void load()}
        retrying={loading}
      />
      {loading && <p role="status">기준값을 읽는 중…</p>}
      {success && (
        <p className={shared.success} role="status">
          {success}
        </p>
      )}
      {!loading && !listError && items.length === 0 && (
        <p>현재 적용 가능한 기준값이 없습니다.</p>
      )}
      {!loading && !listError && (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>항목</th>
                <th>지금 값</th>
                <th>적용 시작월</th>
                <th>쓰는 곳</th>
                <th>조작</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.param_key}
                  data-testid={`param-row-${item.param_key.toLowerCase().replaceAll("_", "-")}`}
                >
                  <td title={item.param_key}>{item.param_name}</td>
                  <td>
                    {displayValue(item)} {item.unit}
                  </td>
                  <td>{item.effective_from}</td>
                  <td>{item.used_in ?? "–"}</td>
                  <td>
                    <Can perm="UI-27.update">
                      <button
                        data-testid={`param-edit-${item.param_key.toLowerCase().replaceAll("_", "-")}`}
                        onClick={() => open(item, "edit")}
                        type="button"
                      >
                        값 변경
                      </button>
                    </Can>
                    <Can perm="UI-27.read">
                      <button
                        data-testid={`param-history-${item.param_key.toLowerCase().replaceAll("_", "-")}`}
                        onClick={() => open(item, "history")}
                        type="button"
                      >
                        이력 보기
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode && selected && (
        <div className={shared.scrim}>
          <section
            className={`${shared.dialog} ${styles.dialog}`}
            role="dialog"
            aria-modal="true"
            aria-label={mode === "edit" ? "값 변경" : "기준값 적용 이력"}
            data-testid={
              mode === "edit" ? "param-edit-dialog" : "param-history-dialog"
            }
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const controls = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input:not(:disabled)",
                ),
              );
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <h2>
              {selected.param_name} {mode === "edit" ? "값 변경" : "적용 이력"}
            </h2>
            <p>{selected.param_key}</p>
            {mode === "edit" ? (
              <form
                className={styles.form}
                onSubmit={(event) => void save(event)}
                noValidate
              >
                <label htmlFor="param-new-value">새 값</label>
                <input
                  id="param-new-value"
                  ref={valueRef}
                  data-testid="param-value-input"
                  value={value}
                  disabled={busy}
                  inputMode={selected.num_value !== null ? "decimal" : "text"}
                  aria-invalid={!!fieldErrors[valueField]}
                  aria-describedby="param-value-error"
                  onChange={(event) => {
                    setValue(event.target.value);
                    onDirtyChange(true);
                  }}
                />
                <p id="param-value-error" className={shared.danger}>
                  {fieldErrors[valueField]}
                </p>
                <label htmlFor="param-month">적용 시작월</label>
                <input
                  id="param-month"
                  ref={monthRef}
                  data-testid="param-month-input"
                  type="month"
                  value={month}
                  min={lastClosed ? nextMonth(lastClosed) : undefined}
                  disabled={busy || boundaryLoading || !!boundaryError}
                  aria-invalid={!!fieldErrors.effective_from}
                  aria-describedby="param-month-error"
                  onChange={(event) => {
                    setMonth(event.target.value);
                    onDirtyChange(true);
                  }}
                />
                <p id="param-month-error" className={shared.danger}>
                  {fieldErrors.effective_from}
                </p>
                {boundaryLoading ? (
                  <p role="status">마감 경계 확인 중…</p>
                ) : (
                  <p>
                    {lastClosed
                      ? `${lastClosed} 마감 · ${nextMonth(lastClosed)}부터 가능`
                      : "마감된 월이 없습니다."}
                  </p>
                )}
                <ErrorBanner
                  error={boundaryError}
                  onRetry={() => void loadBoundary()}
                  retrying={boundaryLoading}
                />
                <ErrorBanner
                  error={saveError}
                  onRetry={() => void save()}
                  retrying={busy}
                />
                <div className={shared.actions}>
                  <button
                    data-testid="param-cancel-button"
                    type="button"
                    onClick={close}
                    disabled={busy}
                  >
                    취소
                  </button>
                  <Can perm="UI-27.update">
                    <button
                      data-testid="param-save-button"
                      type="submit"
                      className={shared.primary}
                      disabled={busy || boundaryLoading || !!boundaryError}
                    >
                      {busy ? "저장 중…" : "저장"}
                    </button>
                  </Can>
                </div>
              </form>
            ) : (
              <>
                <ErrorBanner
                  error={historyError}
                  onRetry={() => void loadHistory(selected)}
                  retrying={historyLoading}
                />
                {historyLoading && <p role="status">적용 이력을 읽는 중…</p>}
                {!historyLoading && !historyError && history.length === 0 && (
                  <p>적용 이력이 없습니다.</p>
                )}
                {!historyLoading && !historyError && (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>적용 시작월</th>
                          <th>값</th>
                          <th>단위</th>
                          <th>쓰는 곳</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((item) => (
                          <tr
                            key={item.effective_from}
                            data-testid={`param-history-row-${item.effective_from}`}
                          >
                            <td>{item.effective_from}</td>
                            <td>{displayValue(item)}</td>
                            <td>{item.unit ?? "–"}</td>
                            <td>{item.used_in ?? "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className={shared.actions}>
                  <button
                    ref={closeRef}
                    data-testid="param-history-close"
                    type="button"
                    onClick={close}
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default ParamsPanel;
