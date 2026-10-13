import { PeriodBar } from "./PeriodBar";
import { PanelTop } from "lucide-react";
import { getScreenDefinition } from "./registry";
import type { MenuScreen } from "./api";
import styles from "./Workspace.module.css";

/** One business placeholder, using API metadata rather than inventing business content. */
export function Placeholder({ screen }: { screen: MenuScreen }) {
  const definition = getScreenDefinition(screen.route);
  return (
    <div className={styles.page}>
      <PeriodBar
        screenId={screen.screen_id!}
        type={definition?.periodType ?? "NONE"}
      />
      <section
        className={styles.placeholder}
        aria-label={`${screen.menu_name} 업무 자리`}
      >
        <PanelTop aria-hidden="true" size={32} strokeWidth={1.5} />
        {"이 화면은 다음 단계에서 만듭니다."}
      </section>
    </div>
  );
}
