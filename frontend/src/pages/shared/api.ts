import { apiGet } from "../../app/api-client";

export interface MenuNode {
  menu_id: string;
  parent_menu_id: string | null;
  menu_name: string;
  screen_id: string | null;
  icon: string | null;
  sort_order: number;
  use_yn?: "Y" | "N";
  mobile_yn: "Y" | "N";
  children: MenuNode[];
}
export interface MonthCloseItem {
  close_month: string;
  status: "OPEN" | "CLOSED";
}
export const getMenus = (signal?: AbortSignal) =>
  apiGet<MenuNode[]>("/api/menus", signal);
export const getMonthClose = (from: string, to: string, signal?: AbortSignal) =>
  apiGet<MonthCloseItem[]>(
    `/api/month-close?${new URLSearchParams({ from, to })}`,
    signal,
  );

export interface MenuScreen extends MenuNode {
  group: string;
  route: string;
}
export function menuScreens(menus: MenuNode[], mobile = false): MenuScreen[] {
  return menus
    .flatMap((group) =>
      group.children
        .filter((item) => item.screen_id && (!mobile || item.mobile_yn === "Y"))
        .map((item) => ({
          ...item,
          group: group.menu_name,
          route: `/${item.screen_id}`,
        })),
    )
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (BigInt(a.menu_id) < BigInt(b.menu_id) ? -1 : 1),
    );
}
