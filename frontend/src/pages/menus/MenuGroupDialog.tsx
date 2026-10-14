import { useEffect, useRef, useState, type FormEvent } from "react";
import Can from "../../components/Can";
import Icon from "../../components/Icon";
import ErrorBanner from "../../components/ErrorBanner";
import { ApiClientError } from "../../app/api-client";
import { createMenuGroup, menuGroupIcons, type AdminMenuNode } from "./api";
import styles from "./Menu.module.css";

export interface MenuGroupDialogProps {
  onCancel: () => void;
  onCreated: (node: AdminMenuNode) => void;
}

/** A group is saved independently; failures retain the draft and never dismiss the dialog. */
export function MenuGroupDialog({ onCancel, onCreated }: MenuGroupDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(menuGroupIcons[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [field, setField] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLSelectElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    if (busy) return;
    if (field === "menu_name") nameRef.current?.focus();
    if (field === "icon") iconRef.current?.focus();
  }, [busy, field]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if ([...name].length < 1 || [...name].length > 50) {
      setField("menu_name");
      setError(new Error("이름은 1~50자로 입력해 주세요."));
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setField(null);
    try {
      const response = await createMenuGroup(name, icon);
      if (!response.data) throw new Error("묶음 응답을 확인할 수 없습니다.");
      onCreated(response.data);
    } catch (failure) {
      const next = failure as Error;
      setError(next);
      const invalid = next instanceof ApiClientError ? next.field : null;
      setField(invalid);
      if (invalid === "menu_name") nameRef.current?.focus();
      if (invalid === "icon") iconRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-group-dialog-title"
        className={styles.dialog}
        data-testid="menu-group-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
          if (event.key !== "Tab") return;
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
            "input,select,button:not(:disabled)",
          );
          if (!controls?.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id="menu-group-dialog-title">묶음 추가</h2>
        <ErrorBanner
          error={error}
          onRetry={() => void submit()}
          retrying={busy}
        />
        <form onSubmit={submit}>
          <label htmlFor="menu-group-name">이름 *</label>
          <input
            ref={nameRef}
            id="menu-group-name"
            data-testid="menu-group-name-input"
            value={name}
            disabled={busy}
            aria-invalid={field === "menu_name"}
            onChange={(event) => setName(event.target.value)}
          />
          {field === "menu_name" && (
            <p className={styles.fieldError}>{error?.message}</p>
          )}
          <label htmlFor="menu-group-icon">아이콘 *</label>
          <div className={styles.iconChoice}>
            <Icon name={icon} />
            <select
              ref={iconRef}
              id="menu-group-icon"
              data-testid="menu-group-icon-select"
              value={icon}
              disabled={busy}
              aria-invalid={field === "icon"}
              onChange={(event) => setIcon(event.target.value)}
            >
              {menuGroupIcons.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          {field === "icon" && (
            <p className={styles.fieldError}>{error?.message}</p>
          )}
          <footer className={styles.actions}>
            <button
              type="button"
              data-testid="menu-group-cancel-button"
              disabled={busy}
              onClick={onCancel}
            >
              취소
            </button>
            <Can perm="UI-25.create">
              <button
                type="submit"
                data-testid="menu-group-create-button"
                className={styles.primary}
                disabled={busy}
              >
                {busy ? "추가 중…" : "추가"}
              </button>
            </Can>
          </footer>
        </form>
      </div>
    </div>
  );
}
