import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Header from "../layout/Header";
import TitleBar from "../layout/TitleBar";
import { usePreferences } from "../stores/preferences";
import styles from "../layout/Shell.module.css";

export interface AppProps {
  children?: ReactNode;
  sidebar?: ReactNode;
  title?: string;
  screenId?: string;
  group?: string;
}

/** Public shell; downstream pages compose directly here without a registration mechanism. */
export default function App({
  children,
  sidebar,
  title = "프로젝트·원가 관리",
  screenId,
  group,
}: AppProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletMenuOpen, setTabletMenuOpen] = useState(false);
  const collapsed = usePreferences((state) => state.menuCollapsed);
  const setCollapsed = usePreferences((state) => state.setMenuCollapsed);
  if (location.pathname === "/") return <Navigate to="/UI-16" replace />;
  function toggleMenu() {
    if (window.matchMedia("(max-width: 767px)").matches)
      setMobileMenuOpen((open) => !open);
    else if (window.matchMedia("(max-width: 1279px)").matches)
      setTabletMenuOpen((open) => !open);
    else setCollapsed(!collapsed);
  }
  return (
    <div className={styles.shell}>
      <Header onToggleMenu={toggleMenu} />
      <div
        className={[
          styles.body,
          collapsed ? styles.collapsed : "",
          tabletMenuOpen ? styles.tabletExpanded : "",
        ].join(" ")}
      >
        {sidebar && (
          <aside
            className={`${styles.sidebar} ${mobileMenuOpen ? styles.mobileOpen : ""}`}
          >
            {sidebar}
          </aside>
        )}
        <main className={styles.main}>
          <TitleBar title={title} screenId={screenId} group={group} />
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}
