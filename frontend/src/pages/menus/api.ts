import { apiGet, apiRequest } from "../../app/api-client";

export type Flag = "Y" | "N";
export interface AdminMenuNode {
  menu_id: string;
  parent_menu_id: string | null;
  menu_name: string;
  screen_id: string | null;
  icon: string | null;
  sort_order: number;
  use_yn: Flag;
  mobile_yn: Flag;
  updated_at: string;
  updated_by: string | null;
  children: AdminMenuNode[];
}
export interface MenuTreeWriteNode {
  menu_id: string;
  parent_menu_id: string | null;
  menu_name: string;
  sort_order: number;
  use_yn: Flag;
  mobile_yn: Flag;
  children: MenuTreeWriteNode[];
}
export const menuGroupIcons = [
  "grid",
  "db",
  "folder",
  "calendar",
  "receipt",
  "chart",
  "wallet",
  "lock",
  "sparkle",
  "gear",
] as const;

export const getAdminMenus = (signal?: AbortSignal) =>
  apiGet<AdminMenuNode[]>("/api/admin/menus", signal);
export const updateAdminMenus = (nodes: MenuTreeWriteNode[]) =>
  apiRequest<AdminMenuNode[]>("/api/admin/menus", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nodes),
  });
export const createMenuGroup = (menu_name: string, icon: string) =>
  apiRequest<AdminMenuNode>("/api/admin/menus/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ menu_name, icon }),
  });

/** Only writable fields go over the wire; identity metadata and audit values never do. */
export const menuWriteTree = (nodes: AdminMenuNode[]): MenuTreeWriteNode[] =>
  nodes.map((node, index) => ({
    menu_id: node.menu_id,
    parent_menu_id: node.parent_menu_id,
    menu_name: node.menu_name,
    sort_order: index + 1,
    use_yn: node.use_yn,
    mobile_yn: node.mobile_yn,
    children: menuWriteTree(node.children),
  }));
