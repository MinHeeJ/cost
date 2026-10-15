import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiClientError } from "../../app/api-client";
import { Can } from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import {
  createCodeGroup,
  type CreateCodeGroupRequest,
  type CodeGroup,
} from "./api";
import shared from "../shared/Workspace.module.css";
import styles from "./CommonCode.module.css";

export interface GroupCreateProps {
  onClose: () => void;
  onCreated: (group: CodeGroup) => void;
  onDirtyChange?: (dirty: boolean) => void;
}
const fields = [
  ["group_code", "그룹 코드", 30],
  ["group_name", "그룹 이름", 100],
  ["attr1_label", "추가 값1 제목", 50],
  ["attr2_label", "추가 값2 제목", 50],
  ["attr3_label", "추가 값3 제목", 50],
] as const;

/** Group creation is local until explicitly submitted; existing code drafts are not reset. */
export function GroupCreate({
  onClose,
  onCreated,
  onDirtyChange,
}: GroupCreateProps) {
  const [draft, setDraft] = useState<CreateCodeGroupRequest>({
    group_code: "",
    group_name: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    onDirtyChange?.(Object.values(draft).some((value) => Boolean(value)));
  }, [draft, onDirtyChange]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    if (!busy && Object.keys(errors).length) {
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${Object.keys(errors)[0]}"]`)
        ?.focus();
    }
  }, [busy, errors]);
  function focus(field: string) {
    form.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (!/^[A-Z_]{1,30}$/.test(draft.group_code))
      next.group_code = "대문자와 _ 1~30자로 입력해 주세요.";
    if (!draft.group_name.trim()) next.group_name = "그룹 이름은 필수입니다.";
    for (const [key, , limit] of fields) {
      if ([...(draft[key] ?? "")].length > limit)
        next[key] = `${limit}자 이내로 입력해 주세요.`;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      focus(Object.keys(next)[0]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await createCodeGroup(draft);
      if (!response.data) throw new Error("그룹 응답을 확인할 수 없습니다.");
      onCreated(response.data);
    } catch (failure) {
      const caught = failure as Error;
      setError(caught);
      if (caught instanceof ApiClientError && caught.field) {
        setErrors({ [caught.field]: caught.message });
        focus(caught.field);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.backdrop}>
      <form
        ref={form}
        role="dialog"
        aria-modal="true"
        aria-label="그룹 추가"
        data-testid="code-group-create-dialog"
        className={styles.dialog}
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") {
            const controls = Array.from(
              form.current?.querySelectorAll<HTMLElement>(
                "input:not(:disabled), button:not(:disabled)",
              ) ?? [],
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
          }
        }}
      >
        <h2>그룹 추가</h2>
        <p>그룹 종류: BIZ</p>
        <ErrorBanner
          error={error}
          onRetry={() => void submit()}
          retrying={busy}
        />
        {fields.map(([key, label, limit]) => (
          <label key={key} className={styles.field}>
            {label}
            <input
              name={key}
              aria-label={label}
              data-testid={`code-group-${key.replaceAll("_", "-")}-input`}
              value={draft[key] ?? ""}
              maxLength={limit}
              disabled={busy}
              aria-invalid={Boolean(errors[key])}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
            />
            {errors[key] && <span className={styles.error}>{errors[key]}</span>}
          </label>
        ))}
        <div className={shared.actions}>
          <button
            type="button"
            data-testid="code-group-create-cancel"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <Can perm="UI-27.create">
            <button
              type="submit"
              data-testid="code-group-create-submit"
              className={shared.primary}
              disabled={busy}
            >
              {busy ? "추가 중…" : "추가"}
            </button>
          </Can>
        </div>
      </form>
    </div>
  );
}
