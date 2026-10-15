import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Can from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import { ApiClientError } from "../../app/api-client";
import shared from "../shared/Workspace.module.css";
import styles from "./ExcelMappings.module.css";
import {
  createExcelMapping,
  getExcelMappingGroups,
  getExcelMappings,
  updateExcelMapping,
  type CreateExcelMappingRequest,
  type ExcelMapping,
  type ExcelMappingGroup,
  type UpdateExcelMappingRequest,
} from "./api";
import { useCodes } from "./useCodes";

const rowKey = (row: ExcelMapping) =>
  JSON.stringify([row.excel_label, row.target_group, row.target_code]);
const asError = (error: unknown) =>
  error instanceof Error ? error : new Error("처리 중 오류가 발생했습니다.");
const count = (text: string) => [...text].length;
interface PanelProps {
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}

/** UI-27의 대응 탭. 공유 화면 소유자가 이 패널을 hidden 상태로 유지하여 초안을 보존한다. */
export default function ExcelMappings({ onDirtyChange, onSaved }: PanelProps) {
  const [rows, setRows] = useState<ExcelMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [modal, setModal] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getExcelMappings();
      if (mounted.current) setRows(result.data ?? []);
    } catch (cause) {
      if (mounted.current) setError(asError(cause));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);
  useEffect(() => {
    onDirtyChange?.(Object.values(dirty).some(Boolean));
  }, [dirty, onDirtyChange]);
  const markDirty = useCallback((key: string, value: boolean) => {
    setDirty((previous) =>
      previous[key] === value ? previous : { ...previous, [key]: value },
    );
  }, []);
  function saved(row: ExcelMapping, created = false) {
    setRows((previous) => {
      const next = created
        ? [...previous, row]
        : previous.map((item) => (rowKey(item) === rowKey(row) ? row : item));
      return next.sort((a, b) =>
        a.excel_label.localeCompare(b.excel_label, "ko"),
      );
    });
    setMessage(created ? "대응을 추가했습니다." : "대응을 저장했습니다.");
    onSaved?.();
  }
  return (
    <section
      className={shared.card}
      data-testid="excel-mappings-panel"
      aria-label="엑셀 표기 대응"
    >
      <div className={shared.row}>
        <h2>엑셀 표기 대응</h2>
        <Can perm="UI-27.create">
          <button
            data-testid="excel-mapping-open"
            onClick={() => setModal(true)}
          >
            + 대응 추가
          </button>
        </Can>
      </div>
      <ErrorBanner
        error={error}
        onRetry={() => void load()}
        retrying={loading}
      />
      {loading && <p role="status">대응을 불러오는 중…</p>}
      {message && (
        <p role="status" data-testid="excel-mapping-success">
          {message}
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p>등록된 엑셀 표기 대응이 없습니다.</p>
      )}
      {rows.length > 0 && (
        <div className={shared.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>엑셀 표기</th>
                <th>바꾸는 값</th>
                <th>주/보조</th>
                <th>메모</th>
                <th>사용</th>
                <th>조작</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ordinal) => (
                <MappingRow
                  key={rowKey(row)}
                  row={row}
                  ordinal={ordinal}
                  onSaved={saved}
                  onDirty={markDirty}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <CreateMappingModal
          onClose={() => {
            setModal(false);
            markDirty("create", false);
          }}
          onCreated={(row) => {
            saved(row, true);
            setModal(false);
            markDirty("create", false);
          }}
          onDirty={(value) => markDirty("create", value)}
        />
      )}
    </section>
  );
}

function FieldError({ error, field }: { error: Error | null; field: string }) {
  return error instanceof ApiClientError && error.field === field ? (
    <p className={styles.error} role="alert">
      {error.message}
    </p>
  ) : null;
}

function MappingRow({
  row,
  ordinal,
  onSaved,
  onDirty,
}: {
  row: ExcelMapping;
  ordinal: number;
  onSaved: (row: ExcelMapping) => void;
  onDirty: (key: string, dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState({
    map_role: row.map_role,
    note: row.note ?? "",
    use_yn: row.use_yn,
  });
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (!busy && error instanceof ApiClientError && error.field) {
      ref.current
        ?.querySelector<HTMLElement>(`[name="${error.field}"]`)
        ?.focus();
    }
  }, [busy, error]);
  const key = rowKey(row);
  const changed =
    draft.map_role !== row.map_role ||
    draft.note !== (row.note ?? "") ||
    draft.use_yn !== row.use_yn;
  useEffect(() => {
    onDirty(key, changed);
  }, [key, changed, onDirty]);
  useEffect(() => {
    setDraft({
      map_role: row.map_role,
      note: row.note ?? "",
      use_yn: row.use_yn,
    });
  }, [row.map_role, row.note, row.use_yn]);
  async function save() {
    if (busy || !changed) return;
    if (count(draft.note) > 200) {
      setError(
        new ApiClientError(
          "메모는 200자 이하로 입력해 주세요.",
          400,
          null,
          "note",
        ),
      );
      ref.current?.querySelector<HTMLInputElement>('[name="note"]')?.focus();
      return;
    }
    const body: UpdateExcelMappingRequest = {};
    if (draft.map_role !== row.map_role) body.map_role = draft.map_role;
    if (draft.note !== (row.note ?? "")) body.note = draft.note || null;
    if (draft.use_yn !== row.use_yn) body.use_yn = draft.use_yn;
    setBusy(true);
    setError(null);
    try {
      const result = await updateExcelMapping(row, body);
      if (result.data) onSaved(result.data);
    } catch (cause) {
      const failure = asError(cause);
      setError(failure);
      if (failure instanceof ApiClientError && failure.field) {
        ref.current
          ?.querySelector<HTMLElement>(`[name="${failure.field}"]`)
          ?.focus();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr ref={ref} data-testid={`excel-mapping-row-${ordinal}`}>
      <td>{row.excel_label}</td>
      <td title={row.target_code}>
        {row.group_name} · {row.code_name}
      </td>
      <td>
        <select
          name="map_role"
          aria-label={`${row.excel_label} 주/보조`}
          data-testid={`excel-mapping-role-${ordinal}`}
          value={draft.map_role}
          disabled={busy}
          onChange={(event) =>
            setDraft({
              ...draft,
              map_role: event.target.value as "MAIN" | "SUB",
            })
          }
        >
          <option value="MAIN">주 MAIN</option>
          <option value="SUB">보조 SUB</option>
        </select>
        <FieldError error={error} field="map_role" />
      </td>
      <td>
        <input
          name="note"
          aria-label={`${row.excel_label} 메모`}
          data-testid={`excel-mapping-note-${ordinal}`}
          value={draft.note}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
        <FieldError error={error} field="note" />
      </td>
      <td>
        <input
          name="use_yn"
          type="checkbox"
          aria-label={`${row.excel_label} 사용`}
          data-testid={`excel-mapping-active-${ordinal}`}
          checked={draft.use_yn === "Y"}
          disabled={busy}
          onChange={(event) =>
            setDraft({ ...draft, use_yn: event.target.checked ? "Y" : "N" })
          }
        />
        <FieldError error={error} field="use_yn" />
      </td>
      <td>
        <Can perm="UI-27.update">
          <button
            data-testid={`excel-mapping-save-${ordinal}`}
            disabled={busy || !changed}
            onClick={() => void save()}
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </Can>
        <button
          data-testid={`excel-mapping-reset-${ordinal}`}
          disabled={busy || !changed}
          onClick={() => {
            setDraft({
              map_role: row.map_role,
              note: row.note ?? "",
              use_yn: row.use_yn,
            });
            setError(null);
          }}
        >
          취소
        </button>
        <ErrorBanner
          error={error}
          onRetry={() => void save()}
          retrying={busy}
        />
      </td>
    </tr>
  );
}

function CreateMappingModal({
  onClose,
  onCreated,
  onDirty,
}: {
  onClose: () => void;
  onCreated: (row: ExcelMapping) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<CreateExcelMappingRequest>({
    excel_label: "",
    target_group: "",
    target_code: "",
    map_role: "MAIN",
    note: "",
  });
  const [groups, setGroups] = useState<ExcelMappingGroup[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState<Error | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const {
    codes,
    loading,
    error: codeError,
    reload,
  } = useCodes(draft.target_group);
  useEffect(() => {
    if (!busy && error instanceof ApiClientError && error.field) {
      form.current
        ?.querySelector<HTMLElement>(`[name="${error.field}"]`)
        ?.focus();
    }
  }, [busy, error]);
  const mounted = useRef(true);
  const loadGroups = useCallback(async () => {
    setGroupLoading(true);
    setGroupError(null);
    try {
      const result = await getExcelMappingGroups();
      if (mounted.current) setGroups(result.data ?? []);
    } catch (cause) {
      if (mounted.current) setGroupError(asError(cause));
    } finally {
      if (mounted.current) setGroupLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void loadGroups();
    const previous = document.activeElement as HTMLElement | null;
    form.current
      ?.querySelector<HTMLInputElement>('input[name="excel_label"]')
      ?.focus();
    return () => {
      mounted.current = false;
      previous?.focus();
    };
  }, [loadGroups]);
  function update(next: Partial<CreateExcelMappingRequest>) {
    setDraft((previous) => ({ ...previous, ...next }));
    onDirty(true);
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const field =
      !draft.excel_label.trim() || count(draft.excel_label) > 100
        ? "excel_label"
        : !draft.target_group
          ? "target_group"
          : !draft.target_code
            ? "target_code"
            : count(draft.note ?? "") > 200
              ? "note"
              : null;
    if (field) {
      setError(
        new ApiClientError(
          "필수값과 입력 길이를 확인해 주세요.",
          400,
          null,
          field,
        ),
      );
      form.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createExcelMapping({
        ...draft,
        note: draft.note || null,
      });
      if (result.data) onCreated(result.data);
    } catch (cause) {
      const failure = asError(cause);
      setError(failure);
      if (failure instanceof ApiClientError && failure.field) {
        form.current
          ?.querySelector<HTMLElement>(`[name="${failure.field}"]`)
          ?.focus();
      }
    } finally {
      setBusy(false);
    }
  }
  const inputs = [
    ["excel_label", "엑셀 표기", "input"],
    ["target_group", "그룹", "group"],
    ["target_code", "코드", "code"],
    ["map_role", "주/보조", "role"],
    ["note", "메모", "input"],
  ] as const;
  return (
    <div className={styles.backdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="대응 추가"
        className={styles.dialog}
        data-testid="excel-mapping-create-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") {
            const controls = Array.from(
              form.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
              ) ?? [],
            );
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2>대응 추가</h2>
        <ErrorBanner
          error={groupError}
          onRetry={() => void loadGroups()}
          retrying={groupLoading}
        />
        <ErrorBanner error={codeError} onRetry={reload} retrying={loading} />
        <ErrorBanner
          error={error}
          onRetry={() => void submit()}
          retrying={busy}
        />
        {groupLoading && <p role="status">그룹을 불러오는 중…</p>}
        {!groupLoading && !groupError && groups.length === 0 && (
          <p>선택할 그룹이 없습니다.</p>
        )}
        {loading && <p role="status">코드를 불러오는 중…</p>}
        {draft.target_group && !loading && !codeError && codes.length === 0 && (
          <p>활성 코드가 없습니다.</p>
        )}
        <form ref={form} onSubmit={(event) => void submit(event)} noValidate>
          {inputs.map(([field, label, kind]) => (
            <label key={field} className={styles.field}>
              <span>
                {label}
                {["excel_label", "target_group", "target_code"].includes(field)
                  ? " *"
                  : ""}
              </span>
              {kind === "input" ? (
                <input
                  name={field}
                  aria-label={label}
                  data-testid={`excel-mapping-create-${field.replaceAll("_", "-")}`}
                  value={draft[field] ?? ""}
                  aria-invalid={
                    error instanceof ApiClientError &&
                    (error.field === field ||
                      (error.code === "DUPLICATE_CODE" &&
                        field === "excel_label"))
                  }
                  disabled={busy}
                  onChange={(event) => update({ [field]: event.target.value })}
                />
              ) : (
                <select
                  name={field}
                  aria-label={label}
                  data-testid={`excel-mapping-create-${field.replaceAll("_", "-")}`}
                  value={draft[field] ?? ""}
                  aria-invalid={
                    error instanceof ApiClientError &&
                    (error.field === field ||
                      (error.code === "DUPLICATE_CODE" &&
                        (kind === "group" || kind === "code")))
                  }
                  title={kind === "code" ? draft.target_code : undefined}
                  disabled={
                    busy ||
                    (kind === "group" && groupLoading) ||
                    (kind === "code" &&
                      (!draft.target_group || loading || Boolean(codeError)))
                  }
                  onChange={(event) =>
                    update({
                      [field]: event.target.value,
                      ...(kind === "group" ? { target_code: "" } : {}),
                    })
                  }
                >
                  {kind !== "role" && <option value="">선택해 주세요</option>}
                  {kind === "group" &&
                    groups.map((group) => (
                      <option key={group.group_code} value={group.group_code}>
                        {group.group_name}
                      </option>
                    ))}
                  {kind === "code" &&
                    codes.map((code) => (
                      <option
                        key={code.code}
                        value={code.code}
                        title={code.code}
                      >
                        {code.name}
                      </option>
                    ))}
                  {kind === "role" && <option value="MAIN">주 MAIN</option>}
                  {kind === "role" && <option value="SUB">보조 SUB</option>}
                </select>
              )}
              <FieldError error={error} field={field} />
            </label>
          ))}
          <div className={shared.actions}>
            <button
              type="button"
              data-testid="excel-mapping-create-cancel"
              disabled={busy}
              onClick={onClose}
            >
              취소
            </button>
            <Can perm="UI-27.create">
              <button
                type="submit"
                data-testid="excel-mapping-create-submit"
                disabled={
                  busy ||
                  groupLoading ||
                  loading ||
                  Boolean(groupError) ||
                  Boolean(codeError)
                }
              >
                {busy ? "추가 중…" : "추가"}
              </button>
            </Can>
          </div>
        </form>
      </section>
    </div>
  );
}
