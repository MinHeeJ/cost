import { create } from "zustand";

export interface ScreenTab {
  route: string;
  name: string;
  dirty: boolean;
  visited: number;
}
interface PendingChange {
  remove: string;
  target: { route: string; name: string } | null;
}
interface TabsState {
  tabs: ScreenTab[];
  active: string;
  clock: number;
  pending: PendingChange | null;
  activate: (route: string, name: string) => void;
  close: (route: string) => void;
  setDirty: (route: string, dirty: boolean) => void;
  confirm: () => void;
  cancel: () => void;
  reset: () => void;
}
const initial = () => ({
  tabs: [{ route: "/UI-16", name: "대시보드", dirty: false, visited: 0 }],
  active: "/UI-16",
  clock: 0,
  pending: null,
});
/** Session-only state: eviction never happens before approval; dashboard is pinned. */
export const useScreenTabs = create<TabsState>((set, get) => ({
  ...initial(),
  activate: (route, name) => {
    const state = get();
    if (state.pending) return;
    const visited = state.clock + 1;
    if (state.tabs.some((tab) => tab.route === route)) {
      set({
        active: route,
        clock: visited,
        tabs: state.tabs.map((tab) =>
          tab.route === route ? { ...tab, name, visited } : tab,
        ),
      });
    } else if (state.tabs.length < 8) {
      set({
        active: route,
        clock: visited,
        tabs: [...state.tabs, { route, name, dirty: false, visited }],
      });
    } else {
      const candidate = state.tabs
        .filter((tab) => tab.route !== "/UI-16")
        .reduce((oldest, tab) => (tab.visited < oldest.visited ? tab : oldest));
      set({ pending: { remove: candidate.route, target: { route, name } } });
    }
  },
  close: (route) => {
    if (route === "/UI-16" || get().pending) return;
    const tab = get().tabs.find((item) => item.route === route);
    if (!tab) return;
    if (tab.dirty) set({ pending: { remove: route, target: null } });
    else
      set((state) => ({
        tabs: state.tabs.filter((item) => item.route !== route),
        active: state.active === route ? "/UI-16" : state.active,
      }));
  },
  setDirty: (route, dirty) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.route === route ? { ...tab, dirty } : tab,
      ),
    })),
  confirm: () =>
    set((state) => {
      if (!state.pending) return {};
      const { remove, target } = state.pending;
      const visited = state.clock + 1;
      const tabs = state.tabs.filter((tab) => tab.route !== remove);
      if (target) tabs.push({ ...target, dirty: false, visited });
      return {
        tabs,
        pending: null,
        clock: visited,
        active:
          target?.route ?? (state.active === remove ? "/UI-16" : state.active),
      };
    }),
  cancel: () => set({ pending: null }),
  reset: () => set(initial()),
}));
