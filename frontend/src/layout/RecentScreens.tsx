import { Link } from "react-router-dom";
import { usePreferences, type RecentScreen } from "../stores/preferences";

export interface RecentScreensProps {
  onNavigate?: (screen: RecentScreen) => void;
}

export function RecentScreens({ onNavigate }: RecentScreensProps) {
  const screens = usePreferences((state) => state.recentScreens);
  return (
    <section aria-label="최근 본 화면">
      <h2>최근 본 화면</h2>
      {screens.length === 0 && <p>최근 본 화면이 없습니다.</p>}
      {screens.map((screen) =>
        onNavigate ? (
          <button
            key={screen.screenId}
            type="button"
            onClick={() => onNavigate(screen)}
          >
            {screen.name}
          </button>
        ) : (
          <Link key={screen.screenId} to={screen.route}>
            {screen.name}
          </Link>
        ),
      )}
    </section>
  );
}

export default RecentScreens;
