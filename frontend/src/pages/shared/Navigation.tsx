import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { usePreferences } from "../../stores/preferences";
import { menuScreens, type MenuNode, type MenuScreen } from "./api";
import { useScreenTabs } from "./tabs";
import styles from "./Workspace.module.css";

export type ActivateScreen = (route: string, name: string) => void;

export function Sidebar({
  menus,
  mobile,
  compact,
  active,
  onActivate,
}: {
  menus: MenuNode[];
  mobile: boolean;
  compact?: boolean;
  active: string;
  onActivate: ActivateScreen;
}) {
  const selected = menus.find((group) =>
    group.children.some((screen) => `/${screen.screen_id}` === active),
  );
  const [expanded, setExpanded] = useState<string | null>(
    selected?.menu_id ?? null,
  );
  const collapsed = usePreferences((state) => state.menuCollapsed);
  useEffect(() => {
    setExpanded(selected?.menu_id ?? null);
  }, [selected?.menu_id]);
  return (
    <nav
      aria-label="업무 메뉴"
      className={`${styles.navigation} ${(compact ?? collapsed) ? styles.iconOnly : ""}`}
    >
      <Favorites screens={menuScreens(menus, mobile)} onActivate={onActivate} />
      <RecentScreens
        screens={menuScreens(menus, mobile)}
        onActivate={onActivate}
      />
      {menus.map((group) => {
        const children = group.children.filter(
          (item) => item.screen_id && (!mobile || item.mobile_yn === "Y"),
        );
        if (!children.length) return null;
        const dashboard = children.find((item) => item.screen_id === "UI-16");
        return (
          <div key={group.menu_id} className={styles.navGroup}>
            <button
              type="button"
              aria-label={group.menu_name}
              aria-expanded={dashboard ? undefined : expanded === group.menu_id}
              className={
                selected?.menu_id === group.menu_id ? styles.groupActive : ""
              }
              onClick={() =>
                dashboard
                  ? onActivate(`/${dashboard.screen_id}`, dashboard.menu_name)
                  : setExpanded(
                      expanded === group.menu_id ? null : group.menu_id,
                    )
              }
            >
              <Icon name={group.icon ?? "grid"} />
              <span className={styles.navLabel}>{group.menu_name}</span>
            </button>
            {!dashboard && (
              <div
                className={`${styles.children} ${expanded === group.menu_id ? styles.expanded : ""}`}
              >
                {children.map((screen) => (
                  <button
                    key={screen.menu_id}
                    type="button"
                    aria-current={
                      active === `/${screen.screen_id}` ? "page" : undefined
                    }
                    onClick={() =>
                      onActivate(`/${screen.screen_id}`, screen.menu_name)
                    }
                  >
                    {screen.menu_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Favorites({
  screens,
  onActivate,
}: {
  screens: MenuScreen[];
  onActivate: ActivateScreen;
}) {
  const ids = usePreferences((state) => state.favorites);
  const setFavorites = usePreferences((state) => state.setFavorites);
  const dragging = useRef<string | null>(null);
  const visible = ids
    .map((id) => screens.find((screen) => screen.screen_id === id))
    .filter((screen): screen is MenuScreen => Boolean(screen));
  return (
    <section aria-label="즐겨찾기" className={styles.quickLinks}>
      <h2>즐겨찾기</h2>
      {!visible.length && <p>즐겨찾는 화면을 등록해 주세요.</p>}
      {visible.map((screen) => (
        <button
          type="button"
          key={screen.screen_id}
          draggable
          onDragStart={() => {
            dragging.current = screen.screen_id;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            const source = dragging.current;
            if (!source || source === screen.screen_id) return;
            const reordered = ids.filter((id) => id !== source);
            reordered.splice(reordered.indexOf(screen.screen_id!), 0, source);
            setFavorites(reordered);
            dragging.current = null;
          }}
          onClick={() => onActivate(screen.route, screen.menu_name)}
        >
          {screen.menu_name}
        </button>
      ))}
    </section>
  );
}

export function RecentScreens({
  screens,
  onActivate,
}: {
  screens: MenuScreen[];
  onActivate: ActivateScreen;
}) {
  const recent = usePreferences((state) => state.recentScreens);
  return (
    <section aria-label="최근 본 화면" className={styles.quickLinks}>
      <h2>최근 본 화면</h2>
      {!recent.length && <p>최근 본 화면이 없습니다.</p>}
      {recent.map((item) => {
        const screen = screens.find(
          (entry) => entry.screen_id === item.screenId,
        );
        return (
          screen && (
            <button
              type="button"
              key={item.screenId}
              onClick={() => onActivate(screen.route, screen.menu_name)}
            >
              {screen.menu_name}
            </button>
          )
        );
      })}
    </section>
  );
}

export function ScreenSearch({
  screens,
  onActivate,
}: {
  screens: MenuScreen[];
  onActivate: ActivateScreen;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        setQuery("");
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  if (!open) return null;
  const results = screens.filter((screen) =>
    screen.menu_name
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div className={styles.scrim}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="화면 이름 검색"
        className={styles.dialog}
      >
        <h2>화면 이름 검색</h2>
        <input
          autoFocus
          aria-label="화면 이름 검색어"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.searchResults}>
          {!results.length && <p>검색 결과가 없습니다.</p>}
          {results.map((screen) => (
            <button
              type="button"
              key={screen.menu_id}
              onClick={() => {
                onActivate(screen.route, screen.menu_name);
                setOpen(false);
              }}
            >
              {screen.menu_name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(false)}>
          닫기
        </button>
      </section>
    </div>
  );
}

export function ScreenTabs({ onActivate }: { onActivate: ActivateScreen }) {
  const state = useScreenTabs();
  return (
    <div role="tablist" aria-label="화면 탭" className={styles.tabs}>
      {state.tabs.map((tab) => (
        <div
          key={tab.route}
          className={tab.route === state.active ? styles.tabActive : styles.tab}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab.route === state.active}
            onClick={() => onActivate(tab.route, tab.name)}
          >
            {tab.dirty ? "● " : ""}
            {tab.name}
          </button>
          {tab.route !== "/UI-16" && (
            <button
              type="button"
              aria-label={`${tab.name} 닫기`}
              onClick={() => state.close(tab.route)}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function UnsavedChangesBoundary() {
  const tabs = useScreenTabs((state) => state.tabs);
  const pending = useScreenTabs((state) => state.pending);
  const dirty = tabs.some((tab) => tab.dirty);
  useEffect(() => {
    if (!pending) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") useScreenTabs.getState().cancel();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [pending]);
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  if (!pending) return null;
  const candidate = tabs.find((tab) => tab.route === pending.remove)!;
  return (
    <div className={styles.scrim}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="화면 닫기 확인"
        className={styles.dialog}
      >
        <h2>화면 닫기 확인</h2>
        <p>
          {candidate.dirty
            ? "저장하지 않은 내용이 있습니다. 나가면 사라집니다."
            : "최대 8개 탭이 열려 있습니다. 가장 오래 안 본 탭을 닫을까요?"}
        </p>
        <p>닫을 화면: {candidate.name}</p>
        <div className={styles.actions}>
          <button
            type="button"
            autoFocus
            onClick={() => useScreenTabs.getState().cancel()}
          >
            {candidate.dirty ? "계속 작성" : "취소"}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => useScreenTabs.getState().confirm()}
          >
            {candidate.dirty ? "나가기" : "교체"}
          </button>
        </div>
      </section>
    </div>
  );
}
