import { create } from "zustand";

export interface RecentScreen {
  screenId: string;
  name: string;
  route: string;
}
export interface Preferences {
  favorites: string[];
  recentScreens: RecentScreen[];
  menuCollapsed: boolean;
  pageSize: 20 | 50 | 100;
  compact: boolean;
}

export const preferenceKeys = {
  favorites: "si.favorites",
  recentScreens: "si.recentScreens",
  menuCollapsed: "si.menuCollapsed",
  pageSize: "si.pageSize",
  compact: "si.compact",
} as const;

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Session remains usable if storage is denied. */
  }
}

export function loadPreferences(): Preferences {
  const favorites = read(preferenceKeys.favorites);
  const recent = read(preferenceKeys.recentScreens);
  const size = read(preferenceKeys.pageSize);
  return {
    favorites: Array.isArray(favorites)
      ? [...new Set(favorites.filter((id) => typeof id === "string"))].slice(
          0,
          10,
        )
      : [],
    recentScreens: Array.isArray(recent)
      ? recent
          .filter(
            (item): item is RecentScreen =>
              item &&
              typeof item.screenId === "string" &&
              typeof item.name === "string" &&
              typeof item.route === "string" &&
              item.route.startsWith("/"),
          )
          .filter(
            (item, index, all) =>
              all.findIndex((other) => other.screenId === item.screenId) ===
              index,
          )
          .slice(0, 5)
      : [],
    menuCollapsed: read(preferenceKeys.menuCollapsed) === true,
    pageSize: size === 20 || size === 100 ? size : 50,
    compact: read(preferenceKeys.compact) === true,
  };
}

interface PreferencesState extends Preferences {
  setMenuCollapsed: (value: boolean) => void;
  setPageSize: (value: 20 | 50 | 100) => void;
  setCompact: (value: boolean) => void;
  setFavorites: (ids: string[]) => boolean;
  recordRecent: (screen: RecentScreen) => void;
  reload: () => void;
}

export const usePreferences = create<PreferencesState>((set) => ({
  ...loadPreferences(),
  setMenuCollapsed: (value) => {
    save(preferenceKeys.menuCollapsed, value);
    set({ menuCollapsed: value });
  },
  setPageSize: (value) => {
    save(preferenceKeys.pageSize, value);
    set({ pageSize: value });
  },
  setCompact: (value) => {
    save(preferenceKeys.compact, value);
    set({ compact: value });
  },
  setFavorites: (ids) => {
    const unique = [...new Set(ids)];
    if (unique.length > 10) return false;
    save(preferenceKeys.favorites, unique);
    set({ favorites: unique });
    return true;
  },
  recordRecent: (screen) =>
    set((state) => {
      const recentScreens = [
        screen,
        ...state.recentScreens.filter(
          (item) => item.screenId !== screen.screenId,
        ),
      ].slice(0, 5);
      save(preferenceKeys.recentScreens, recentScreens);
      return { recentScreens };
    }),
  reload: () => set(loadPreferences()),
}));
