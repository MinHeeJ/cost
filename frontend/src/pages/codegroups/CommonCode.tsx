import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiClientError } from "../../app/api-client";
import { Can } from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import { useScreenTabs } from "../shared/tabs";
import shared from "../shared/Workspace.module.css";
import styles from "./CommonCode.module.css";
import { GroupCreate } from "./GroupCreate";
import {
  getCodeGroups,
  getGroupCodes,
  updateGroupCodes,
  CODE_OPTIONS_CHANGED,
  type AdminCode,
  type CodeGroup,
  type CodeWriteItem,
} from "./api";

export interface CommonCodePanel {
  id: string;
  title: string;
  content: ReactNode;
}
export interface CommonCodeProps {
  panels?: CommonCodePanel[];
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}
interface CodeDraft {
  rows: AdminCode[];
  original: AdminCode[];
  dirty: boolean;
}
const copy = (rows: AdminCode[]) => rows.map((row) => ({ ...row }));

/** UI-27 code editing; the parent supplies other feature panels without circular imports. */
export function CommonCode({
  panels = [],
  onDirtyChange,
  onSaved,
}: CommonCodeProps) {
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [selected, setSelected] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CodeDraft>>({});
  const [tab, setTab] = useState("codes");
  const [groupError, setGroupError] = useState<Error | null>(null);
  const [codeError, setCodeError] = useState<Error | null>(null);
  const [fieldError, setFieldError] = useState<{
    row: number;
    field: string;
    message: string;
  } | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [codeLoading, setCodeLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const table = useRef<HTMLTableElement>(null);
  const drag = useRef<number | null>(null);
  useEffect(() => {
    if (!busy && fieldError) {
      table.current
        ?.querySelector<HTMLInputElement>(
          `[data-row="${fieldError.row}"][name="${fieldError.field}"]`,
        )
        ?.focus();
    }
  }, [busy, fieldError]);
  const group = groups.find((item) => item.group_code === selected);
  const draft = drafts[selected];
  const rows = draft?.rows ?? [];
  const system = group?.group_kind === "SYSTEM";
  const dirty = createDirty || Object.values(drafts).some((item) => item.dirty);
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(dirty);
    else useScreenTabs.getState().setDirty("/UI-27", dirty);
  }, [dirty, onDirtyChange]);
  const loadGroups = useCallback(async () => {
    setGroupLoading(true);
    setGroupError(null);
    try {
      const response = await getCodeGroups();
      if (!response.data) throw new Error("그룹 응답을 확인할 수 없습니다.");
      setGroups(response.data);
      setSelected((value) => value || response.data?.[0]?.group_code || "");
    } catch (error) {
      setGroupError(error as Error);
    } finally {
      setGroupLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);
  const loadCodes = useCallback(async (key: string) => {
    setCodeLoading(true);
    setCodeError(null);
    try {
      const response = await getGroupCodes(key);
      if (!response.data) throw new Error("코드 응답을 확인할 수 없습니다.");
      const snapshot = copy(response.data);
      setDrafts((state) => ({
        ...state,
        [key]: { rows: copy(snapshot), original: snapshot, dirty: false },
      }));
    } catch (error) {
      setCodeError(error as Error);
    } finally {
      setCodeLoading(false);
    }
  }, []);
  useEffect(() => {
    if (selected && !drafts[selected]) void loadCodes(selected);
    setFieldError(null);
    setCodeError(null);
  }, [selected, loadCodes]);
  function change(
    index: number,
    field: keyof AdminCode,
    value: string | number | null,
  ) {
    setDrafts((state) => {
      const next = copy(state[selected].rows);
      next[index] = { ...next[index], [field]: value };
      return {
        ...state,
        [selected]: { ...state[selected], rows: next, dirty: true },
      };
    });
    setFieldError(null);
    setNotice("");
  }
  function move(from: number, to: number) {
    if (busy || from === to) return;
    setDrafts((state) => {
      const next = copy(state[selected].rows);
      next.splice(to, 0, next.splice(from, 1)[0]);
      next.forEach((item, index) => {
        item.sort_order = index + 1;
      });
      return {
        ...state,
        [selected]: { ...state[selected], rows: next, dirty: true },
      };
    });
  }
  function invalid(index: number, field: string, message: string) {
    setFieldError({ row: index, field, message });
    table.current
      ?.querySelector<HTMLInputElement>(
        `[data-row="${index}"][name="${field}"]`,
      )
      ?.focus();
  }
  async function save() {
    if (busy || !draft) return;
    for (const [index, row] of rows.entries()) {
      if (!/^[A-Z0-9_]{1,30}$/.test(row.code))
        return invalid(index, "code", "대문자·숫자·_ 1~30자로 입력해 주세요.");
      if (!row.code_name.trim())
        return invalid(index, "code_name", "이름은 필수입니다.");
      if ([...row.code_name].length > 100)
        return invalid(index, "code_name", "100자 이내로 입력해 주세요.");
      if (!Number.isInteger(row.sort_order))
        return invalid(index, "sort_order", "순서는 정수로 입력해 주세요.");
    }
    setBusy(true);
    setCodeError(null);
    setFieldError(null);
    let saved = false;
    try {
      const body: CodeWriteItem[] = rows.map(
        ({ group_code: _group, ...row }) => row,
      );
      const result = await updateGroupCodes(selected, body);
      if (!result.data) throw new Error("코드 응답을 확인할 수 없습니다.");
      const snapshot = copy(result.data);
      setDrafts((state) => ({
        ...state,
        [selected]: { rows: copy(snapshot), original: snapshot, dirty: false },
      }));
      saved = true;
      onSaved?.();
      setNotice("코드를 저장했습니다");
      window.dispatchEvent(
        new CustomEvent(CODE_OPTIONS_CHANGED, { detail: { group: selected } }),
      );
      await Promise.all([loadCodes(selected), loadGroups()]);
    } catch (error) {
      setCodeError(error as Error);
      if (!saved && error instanceof ApiClientError && error.field)
        invalid(0, error.field, error.message);
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (!draft) return;
    setDrafts((state) => ({
      ...state,
      [selected]: { ...draft, rows: copy(draft.original), dirty: false },
    }));
    setFieldError(null);
    setCodeError(null);
    setNotice("");
  }
  function add() {
    if (!draft || system) return;
    const row: AdminCode = {
      group_code: selected,
      code: "",
      code_name: "",
      attr1: null,
      attr2: null,
      attr3: null,
      sort_order: Math.max(0, ...rows.map((item) => item.sort_order)) + 1,
      use_yn: "Y",
      effective_from: null,
    };
    setDrafts((state) => ({
      ...state,
      [selected]: { ...draft, rows: [...rows, row], dirty: true },
    }));
  }
  function input(
    index: number,
    field: keyof AdminCode,
    label: string,
    readOnly = false,
    type = "text",
  ) {
    const row = rows[index];
    const error =
      fieldError?.row === index && fieldError.field === field
        ? fieldError.message
        : null;
    return (
      <label className={styles.field}>
        <input
          aria-label={`${label} ${index + 1}`}
          name={field}
          data-row={index}
          data-testid={`code-row-${index}-${field.replaceAll("_", "-")}`}
          type={type}
          value={row[field] ?? ""}
          readOnly={readOnly}
          disabled={busy}
          aria-invalid={Boolean(error)}
          onChange={(event) =>
            change(
              index,
              field,
              type === "number"
                ? Number(event.target.value)
                : event.target.value ||
                    (field === "code_name" || field === "code" ? "" : null),
            )
          }
        />
        {error && <span className={styles.error}>{error}</span>}
      </label>
    );
  }
  return (
    <section className={shared.page} data-testid="common-code-page">
      <div className={shared.row}>
        <h2>공통코드</h2>
        <Can perm="UI-27.create">
          <button
            data-testid="code-group-add-button"
            disabled={busy}
            onClick={() => setCreating(true)}
          >
            + 그룹 추가
          </button>
        </Can>
      </div>
      <Can perm="UI-27.read">
        <div role="tablist" aria-label="공통코드 영역" className={shared.row}>
          {[{ id: "codes", title: "코드" }, ...panels].map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              data-testid={`common-code-tab-${item.id}`}
              onClick={() => setTab(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>
      </Can>
      <div
        role="tabpanel"
        hidden={tab !== "codes"}
        data-testid="common-code-panel-codes"
      >
        <ErrorBanner
          error={groupError}
          onRetry={() => void loadGroups()}
          retrying={groupLoading}
        />
        {groupLoading && <p role="status">그룹을 읽는 중…</p>}
        {!groupLoading && !groupError && groups.length === 0 && (
          <p>코드 그룹이 없습니다.</p>
        )}
        <div className={styles.columns}>
          <div className={styles.groups}>
            {groups.map((item) => (
              <button
                key={item.group_code}
                data-testid={`code-group-${item.group_code.toLowerCase().replaceAll("_", "-")}`}
                className={
                  selected === item.group_code ? styles.selected : undefined
                }
                aria-pressed={selected === item.group_code}
                disabled={busy}
                title={item.group_code}
                onClick={() => setSelected(item.group_code)}
              >
                {item.group_name}{" "}
                {item.group_kind === "SYSTEM" ? "잠금" : `${item.code_count}개`}
                {drafts[item.group_code]?.dirty ? " ●" : ""}
              </button>
            ))}
          </div>
          <div className={shared.page}>
            {system && (
              <p className={shared.locked}>
                계산 규칙에 쓰는 시스템 코드입니다. 이름과 순서만 바꿀 수
                있습니다.
              </p>
            )}
            <ErrorBanner
              error={codeError}
              onRetry={() =>
                draft?.dirty ? void save() : void loadCodes(selected)
              }
              retrying={busy || codeLoading}
            />
            {codeLoading && <p role="status">코드를 읽는 중…</p>}
            {notice && (
              <p role="status" data-testid="code-save-success">
                {notice}
              </p>
            )}
            {draft && !codeLoading && (
              <>
                <div className={shared.tableScroll}>
                  <table ref={table}>
                    <thead>
                      <tr>
                        <th>끌기</th>
                        <th>코드</th>
                        <th>이름</th>
                        {([1, 2, 3] as const).map(
                          (n) =>
                            group?.[`attr${n}_label`] && (
                              <th key={n}>{group[`attr${n}_label`]}</th>
                            ),
                        )}
                        <th>순서</th>
                        <th>적용 시작일</th>
                        <th>사용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={9}>선택 그룹 코드가 없습니다.</td>
                        </tr>
                      )}
                      {rows.map((row, index) => (
                        <tr
                          key={index}
                          data-testid={`code-row-${index}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (drag.current !== null)
                              move(drag.current, index);
                            drag.current = null;
                          }}
                        >
                          <td>
                            <button
                              draggable={!busy}
                              data-testid={`code-row-${index}-move`}
                              aria-label={`순서 이동 ${index + 1}`}
                              disabled={busy}
                              onDragStart={() => {
                                drag.current = index;
                              }}
                              onKeyDown={(event) => {
                                const to =
                                  event.key === "ArrowUp"
                                    ? index - 1
                                    : event.key === "ArrowDown"
                                      ? index + 1
                                      : -1;
                                if (to >= 0 && to < rows.length) {
                                  event.preventDefault();
                                  move(index, to);
                                }
                              }}
                            >
                              ↕
                            </button>
                          </td>
                          <td>
                            {input(
                              index,
                              "code",
                              "코드",
                              draft.original.some(
                                (item) => item.code === row.code,
                              ),
                            )}
                          </td>
                          <td>{input(index, "code_name", "이름")}</td>
                          {([1, 2, 3] as const).map(
                            (n) =>
                              group?.[`attr${n}_label`] && (
                                <td key={n}>
                                  {input(
                                    index,
                                    `attr${n}`,
                                    group[`attr${n}_label`] ?? "",
                                    system,
                                  )}
                                </td>
                              ),
                          )}
                          <td>
                            {input(
                              index,
                              "sort_order",
                              "순서",
                              false,
                              "number",
                            )}
                          </td>
                          <td>
                            {input(
                              index,
                              "effective_from",
                              "적용 시작일",
                              system,
                              "date",
                            )}
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              data-testid={`code-row-${index}-use`}
                              aria-label={`사용 ${index + 1}`}
                              checked={row.use_yn === "Y"}
                              disabled={
                                system ||
                                busy ||
                                !draft.original.some(
                                  (item) => item.code === row.code,
                                )
                              }
                              onChange={(event) =>
                                change(
                                  index,
                                  "use_yn",
                                  event.target.checked ? "Y" : "N",
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!system && (
                  <Can perm="UI-27.create">
                    <button
                      data-testid="code-add-button"
                      disabled={busy}
                      onClick={add}
                    >
                      + 코드 추가
                    </button>
                  </Can>
                )}
                <div className={shared.actions}>
                  <button
                    data-testid="code-cancel-button"
                    disabled={busy}
                    onClick={cancel}
                  >
                    취소
                  </button>
                  <Can perm="UI-27.update">
                    <button
                      data-testid="code-save-button"
                      className={shared.primary}
                      disabled={busy || !draft.dirty}
                      onClick={() => void save()}
                    >
                      {busy ? "저장 중…" : "저장"}
                    </button>
                  </Can>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {panels.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          hidden={tab !== panel.id}
          data-testid={`common-code-panel-${panel.id}`}
        >
          {panel.content}
        </div>
      ))}
      {creating && (
        <GroupCreate
          onDirtyChange={setCreateDirty}
          onClose={() => {
            setCreating(false);
            setCreateDirty(false);
          }}
          onCreated={() => {
            onSaved?.();
            setCreating(false);
            setCreateDirty(false);
            setNotice("그룹을 추가했습니다");
            void loadGroups();
          }}
        />
      )}
    </section>
  );
}
export default CommonCode;
