import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import Icon from "../components/Icon";
import { usePreferences } from "../stores/preferences";
import styles from "./Shell.module.css";

export interface HeaderProps {
  onToggleMenu: () => void;
}

export function Header({ onToggleMenu }: HeaderProps) {
  const [panel, setPanel] = useState<"notifications" | "settings" | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const preferences = usePreferences();
  useEffect(() => {
    function close(event: MouseEvent) {
      if (!anchor.current?.contains(event.target as Node)) setPanel(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <header className={styles.header}>
      <button
        className={styles.iconButton}
        type="button"
        aria-label="메뉴 열기/접기"
        onClick={onToggleMenu}
      >
        <Icon name="menu" />
      </button>
      <Link className={styles.brand} to="/UI-16">
        <span className={styles.brandIcon}>
          <Icon name="grid" size={16} />
        </span>
        <span className={styles.brandLabel}>프로젝트·원가 관리</span>
      </Link>
      <div className={styles.headerActions} ref={anchor}>
        <button
          className={styles.iconButton}
          type="button"
          aria-label="알림"
          aria-expanded={panel === "notifications"}
          onClick={() =>
            setPanel(panel === "notifications" ? null : "notifications")
          }
        >
          <Icon name="bell" />
        </button>
        <button
          className={styles.userButton}
          type="button"
          aria-label="기본 사용자 화면 설정"
          aria-expanded={panel === "settings"}
          onClick={() => setPanel(panel === "settings" ? null : "settings")}
        >
          <UserRound aria-hidden="true" size={20} strokeWidth={1.8} />
          <span className={styles.userLabel}>기본 사용자</span>
          <Icon className={styles.userLabel} name="down" size={16} />
        </button>
        {panel === "notifications" && (
          <div className={styles.popover} role="status">
            새 알림이 없습니다
          </div>
        )}
        {panel === "settings" && (
          <div className={styles.popover} aria-label="화면 설정">
            <label>
              목록 기본 건수
              <select
                value={preferences.pageSize}
                onChange={(event) =>
                  preferences.setPageSize(
                    Number(event.target.value) as 20 | 50 | 100,
                  )
                }
              >
                <option value="20">20건</option>
                <option value="50">50건</option>
                <option value="100">100건</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences.compact}
                onChange={(event) =>
                  preferences.setCompact(event.target.checked)
                }
              />
              좁게 보기
            </label>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
