import type { ReactNode } from "react";
import Icon from "../components/Icon";
import styles from "./Shell.module.css";

export interface TitleBarProps {
  title: string;
  screenId?: string;
  group?: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  actions?: ReactNode;
}

export function TitleBar({
  title,
  screenId,
  group,
  favorite,
  onToggleFavorite,
  actions,
}: TitleBarProps) {
  return (
    <div className={styles.titlebar}>
      <div className={styles.titleHeading}>
        {group && (
          <p className={styles.breadcrumb}>
            {group} › {title}
          </p>
        )}
        <div className={styles.titleRow}>
          <h1>{title}</h1>
          {onToggleFavorite && (
            <button
              className={styles.favoriteButton}
              type="button"
              aria-label="즐겨찾기"
              aria-pressed={favorite ?? false}
              onClick={onToggleFavorite}
            >
              <Icon
                name="star"
                size={16}
                fill={favorite ? "currentColor" : "none"}
              />
            </button>
          )}
          {screenId && <span className={styles.screenId}>{screenId}</span>}
        </div>
      </div>
      <div className={styles.titleActions}>{actions}</div>
    </div>
  );
}

export default TitleBar;
