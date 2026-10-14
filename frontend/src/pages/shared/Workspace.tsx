import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Header from "../../layout/Header";
import Icon from "../../components/Icon";
import TitleBar from "../../layout/TitleBar";
import ErrorBanner from "../../components/ErrorBanner";
import { usePreferences } from "../../stores/preferences";
import { getMenus, menuScreens, type MenuNode } from "./api";
import { screenRoutes } from "./registry";
import { Placeholder } from "./Placeholder";
import { Components } from "./Components";
import Menu from "../menus/Menu";
import CommonCodeScreen from "../../app/CommonCodeScreen";
import {
  Sidebar,
  ScreenSearch,
  ScreenTabs,
  UnsavedChangesBoundary,
} from "./Navigation";
import { useScreenTabs } from "./tabs";
import shell from "../../layout/Shell.module.css";
import styles from "./Workspace.module.css";

function useMobile(query = "(max-width: 767px)") {
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return mobile;
}

/** Directly composable public workspace; final entrypoint wiring belongs to its own owner. */
export function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useMobile();
  const tablet = useMobile("(min-width: 768px) and (max-width: 1279px)");
  const [menus, setMenus] = useState<MenuNode[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tabletOpen, setTabletOpen] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const preferences = usePreferences();
  const tabs = useScreenTabs();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    getMenus(abort.signal)
      .then((response) => {
        if (!abort.signal.aborted) setMenus(response.data ?? []);
      })
      .catch((failure: Error) => {
        if (!abort.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [retry]);
  const screens = menuScreens(menus ?? []);
  const visibleScreens = menuScreens(menus ?? [], mobile);
  const requestedRoute =
    location.pathname === "/" ? "/UI-16" : location.pathname;
  const missingScreen =
    menus !== null &&
    !loading &&
    !error &&
    menus.length > 0 &&
    requestedRoute !== "/dev/components" &&
    !screens.some((screen) => screen.route === requestedRoute);
  const activeScreen = screens.find((screen) => screen.route === tabs.active);
  const activeName =
    tabs.active === "/dev/components"
      ? "공통 부품 견본"
      : activeScreen?.menu_name;
  const forbidden =
    mobile &&
    activeScreen?.mobile_yn !== "Y" &&
    tabs.active !== "/dev/components";
  useEffect(() => {
    if (!menus) return;
    const requested = location.pathname === "/" ? "/UI-16" : location.pathname;
    if (!screenRoutes.includes(requested)) return;
    if (lastPath.current !== location.pathname) {
      lastPath.current = location.pathname;
      const screen = menuScreens(menus).find(
        (item) => item.route === requested,
      );
      if (screen || requested === "/dev/components") {
        useScreenTabs
          .getState()
          .activate(requested, screen?.menu_name ?? "공통 부품 견본");
        if (useScreenTabs.getState().pending)
          navigate(useScreenTabs.getState().active, { replace: true });
      }
      return;
    }
    if (tabs.active !== requested) navigate(tabs.active);
  }, [location.pathname, menus, tabs.active, navigate]);
  useEffect(() => {
    if (!activeScreen || forbidden) return;
    preferences.recordRecent({
      screenId: activeScreen.screen_id!,
      name: activeScreen.menu_name,
      route: activeScreen.route,
    });
  }, [activeScreen?.screen_id, forbidden]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function activate(route: string, name: string) {
    useScreenTabs.getState().activate(route, name);
    if (!useScreenTabs.getState().pending) {
      lastPath.current = route;
      navigate(route);
      setMobileOpen(false);
    }
  }
  function toggleMenu() {
    if (mobile) setMobileOpen(!mobileOpen);
    else if (window.matchMedia("(max-width: 1279px)").matches)
      setTabletOpen(!tabletOpen);
    else preferences.setMenuCollapsed(!preferences.menuCollapsed);
  }
  function toggleFavorite() {
    if (!activeScreen) return;
    const id = activeScreen.screen_id!;
    const next = preferences.favorites.includes(id)
      ? preferences.favorites.filter((item) => item !== id)
      : [...preferences.favorites, id];
    setFavoriteMessage(
      preferences.setFavorites(next)
        ? ""
        : "즐겨찾기는 최대10개까지 등록할 수 있습니다.",
    );
  }
  if (location.pathname === "/") return <Navigate to="/UI-16" replace />;
  return (
    <div className={shell.shell}>
      <Header onToggleMenu={toggleMenu} />
      <div
        className={[
          shell.body,
          preferences.menuCollapsed ? shell.collapsed : "",
          tabletOpen ? shell.tabletExpanded : "",
        ].join(" ")}
      >
        <aside
          className={`${shell.sidebar} ${mobileOpen ? shell.mobileOpen : ""}`}
        >
          <Sidebar
            menus={menus ?? []}
            mobile={mobile}
            compact={
              !mobile && (tablet ? !tabletOpen : preferences.menuCollapsed)
            }
            active={tabs.active}
            onActivate={activate}
          />
          {!mobile && (
            <button
              type="button"
              className={shell.collapseButton}
              aria-label={
                (tablet ? !tabletOpen : preferences.menuCollapsed)
                  ? "메뉴 펼치기"
                  : "메뉴 접기"
              }
              onClick={toggleMenu}
            >
              <Icon
                name={
                  (tablet ? !tabletOpen : preferences.menuCollapsed)
                    ? "right"
                    : "left"
                }
                size={16}
              />
              {!(tablet ? !tabletOpen : preferences.menuCollapsed) && (
                <span>메뉴 접기</span>
              )}
            </button>
          )}
          {mobileOpen && (
            <button type="button" onClick={() => setMobileOpen(false)}>
              메뉴 닫기
            </button>
          )}
        </aside>
        <main className={shell.main}>
          <ScreenTabs onActivate={activate} />
          {!forbidden && !missingScreen && (
            <TitleBar
              title={activeName ?? "프로젝트·원가 관리"}
              screenId={activeScreen?.screen_id ?? undefined}
              group={activeScreen?.group}
              favorite={preferences.favorites.includes(
                activeScreen?.screen_id ?? "",
              )}
              onToggleFavorite={activeScreen ? toggleFavorite : undefined}
            />
          )}
          <div className={shell.content}>
            <ErrorBanner
              error={error}
              retrying={loading}
              onRetry={() => setRetry((value) => value + 1)}
            />
            {loading && !menus && (
              <div role="status" className={styles.skeleton}>
                메뉴 읽는 중…
              </div>
            )}
            {favoriteMessage && <p role="status">{favoriteMessage}</p>}
            {missingScreen && (
              <section role="status" className={styles.placeholder}>
                <p>
                  {screenRoutes.includes(requestedRoute)
                    ? "이 화면의 메뉴 정보를 찾을 수 없습니다."
                    : "등록된 화면이 없습니다."}
                </p>
                <button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  다시 읽기
                </button>
              </section>
            )}
            {menus && !menus.length && (
              <div role="status">
                <p>사용 메뉴가 없습니다.</p>
                <button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  다시 읽기
                </button>
              </div>
            )}
            {forbidden && activeScreen && (
              <section className={styles.placeholder}>
                <p>PC에서 이용해 주세요</p>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => activate("/UI-16", "대시보드")}
                >
                  대시보드로
                </button>
              </section>
            )}
            {tabs.tabs.map((tab) => {
              const screen = screens.find((item) => item.route === tab.route);
              return (
                <div
                  key={tab.route}
                  hidden={
                    tab.route !== tabs.active || forbidden || missingScreen
                  }
                >
                  {tab.route === "/dev/components" ? (
                    <Components />
                  ) : tab.route === "/UI-25" ? (
                    <Menu onMenusChanged={setMenus} />
                  ) : tab.route === "/UI-27" ? (
                    <CommonCodeScreen />
                  ) : (
                    screen && <Placeholder screen={screen} />
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
      <ScreenSearch screens={visibleScreens} onActivate={activate} />
      <UnsavedChangesBoundary />
    </div>
  );
}

export default Workspace;
