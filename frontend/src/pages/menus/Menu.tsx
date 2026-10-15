import { useEffect, useRef, useState } from "react";
import Can from "../../components/Can";
import Icon from "../../components/Icon";
import ErrorBanner from "../../components/ErrorBanner";
import { ApiClientError } from "../../app/api-client";
import { getMenus, type MenuNode } from "../shared/api";
import { useScreenTabs } from "../shared/tabs";
import {
  getAdminMenus,
  menuWriteTree,
  updateAdminMenus,
  type AdminMenuNode,
} from "./api";
import { MenuGroupDialog } from "./MenuGroupDialog";
import styles from "./Menu.module.css";

export interface MenuProps {
  /** Wiring passes this to Workspace.setMenus so the existing navigation changes immediately. */
  onMenusChanged?: (menus: MenuNode[]) => void;
}
const required = (node: AdminMenuNode) =>
  node.screen_id === "UI-16" || node.screen_id === "UI-25";
const copy = (nodes: AdminMenuNode[]) => structuredClone(nodes);
const ordered = (nodes: AdminMenuNode[]): AdminMenuNode[] =>
  nodes.map((node, index) => ({
    ...node,
    sort_order: index + 1,
    children: node.children.map((child, childIndex) => ({
      ...child,
      parent_menu_id: node.menu_id,
      sort_order: childIndex + 1,
    })),
  }));

/** UI-25 edits only existing IDs; tab state and failed drafts survive shell tab switches. */
export function Menu({ onMenusChanged }: MenuProps) {
  const [nodes, setNodes] = useState<AdminMenuNode[]>([]);
  const [snapshot, setSnapshot] = useState<AdminMenuNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState(false);
  const [invalidNames, setInvalidNames] = useState<string[]>([]);
  const [refreshPending, setRefreshPending] = useState(false);
  const [groupRefreshPending, setGroupRefreshPending] = useState(false);
  const dragging = useRef<string | null>(null);
  const container = useRef<HTMLElement>(null);
  const dirty =
    JSON.stringify(menuWriteTree(nodes)) !==
    JSON.stringify(menuWriteTree(snapshot));
  useEffect(() => {
    useScreenTabs.getState().setDirty("/UI-25", dirty);
  }, [dirty]);
  useEffect(() => {
    if (
      !busy &&
      error instanceof ApiClientError &&
      error.field?.includes("menu_name")
    ) {
      container.current
        ?.querySelector<HTMLInputElement>("[data-menu-name]")
        ?.focus();
    }
  }, [busy, error]);
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, []);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminMenus(signal);
      if (!response.data) throw new Error("메뉴 응답을 확인할 수 없습니다.");
      if (signal?.aborted) return;
      setNodes(copy(response.data));
      setSnapshot(copy(response.data));
      setLoaded(true);
      setInvalidNames([]);
    } catch (failure) {
      if (!signal?.aborted) setError(failure as Error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function refreshNavigation() {
    const response = await getMenus();
    if (!response.data) throw new Error("탐색 메뉴 응답을 확인할 수 없습니다.");
    onMenusChanged?.(response.data);
    setRefreshPending(false);
  }

  async function retry() {
    if (groupRefreshPending) {
      await refreshAfterGroup();
    } else if (refreshPending) {
      setBusy(true);
      setError(null);
      try {
        await refreshNavigation();
        setMessage("메뉴를 저장했습니다");
      } catch (failure) {
        setError(failure as Error);
      } finally {
        setBusy(false);
      }
    } else if (loaded && dirty) {
      await save();
    } else {
      await load();
    }
  }

  async function save() {
    if (busy || loading || !loaded) return;
    const invalid = nodes
      .flatMap((group) => [group, ...group.children])
      .filter(
        (node) =>
          [...node.menu_name].length < 1 || [...node.menu_name].length > 50,
      )
      .map((node) => node.menu_id);
    setInvalidNames(invalid);
    if (invalid.length) {
      setError(new Error("이름은 1~50자로 입력해 주세요."));
      container.current
        ?.querySelector<HTMLInputElement>(`[data-menu-name="${invalid[0]}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const response = await updateAdminMenus(menuWriteTree(nodes));
      if (!response.data) throw new Error("메뉴 응답을 확인할 수 없습니다.");
      setNodes(copy(response.data));
      setSnapshot(copy(response.data));
      useScreenTabs.getState().setDirty("/UI-25", false);
      setRefreshPending(true);
      await refreshNavigation();
      setMessage("메뉴를 저장했습니다");
    } catch (failure) {
      setError(failure as Error);
      if (
        failure instanceof ApiClientError &&
        failure.field?.includes("menu_name")
      ) {
        const input =
          container.current?.querySelector<HTMLInputElement>(
            "[data-menu-name]",
          );
        input?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  function edit(id: string, patch: Partial<AdminMenuNode>) {
    setMessage("");
    setNodes((current) =>
      current.map((group) =>
        group.menu_id === id
          ? { ...group, ...patch }
          : {
              ...group,
              children: group.children.map((child) =>
                child.menu_id === id ? { ...child, ...patch } : child,
              ),
            },
      ),
    );
  }

  /** Roots reorder only with roots; a leaf can move into a root or before another leaf. */
  function move(id: string, targetId: string) {
    if (id === targetId || busy) return;
    const next = copy(nodes);
    const rootIndex = next.findIndex((node) => node.menu_id === id);
    const targetRoot = next.findIndex((node) => node.menu_id === targetId);
    if (rootIndex >= 0) {
      if (targetRoot < 0) return;
      const [root] = next.splice(rootIndex, 1);
      next.splice(targetRoot, 0, root);
    } else {
      const old = next.find((group) =>
        group.children.some((node) => node.menu_id === id),
      );
      const target = next.find(
        (group) =>
          group.menu_id === targetId ||
          group.children.some((node) => node.menu_id === targetId),
      );
      if (!old || !target) return;
      const index = old.children.findIndex((node) => node.menu_id === id);
      const [child] = old.children.splice(index, 1);
      child.parent_menu_id = target.menu_id;
      const before = target.children.findIndex(
        (node) => node.menu_id === targetId,
      );
      target.children.splice(
        before < 0 ? target.children.length : before,
        0,
        child,
      );
      if (required(child)) target.use_yn = "Y";
    }
    setNodes(ordered(next));
    setMessage("");
  }

  function step(node: AdminMenuNode, direction: -1 | 1) {
    const siblings =
      node.parent_menu_id === null
        ? nodes
        : (nodes.find((group) => group.menu_id === node.parent_menu_id)
            ?.children ?? []);
    const index = siblings.findIndex((item) => item.menu_id === node.menu_id);
    const target = siblings[index + direction];
    if (!target) return;
    if (direction === -1) move(node.menu_id, target.menu_id);
    else move(target.menu_id, node.menu_id);
  }

  function groupCreated(node: AdminMenuNode) {
    // Preserve local edits; successful new IDs are part of the cancel baseline too.
    setNodes((current) => ordered([...current, node]));
    setSnapshot((current) => ordered([...current, copy([node])[0]]));
    setDialog(false);
    setGroupRefreshPending(true);
    void refreshAfterGroup();
  }

  async function refreshAfterGroup() {
    setBusy(true);
    setError(null);
    try {
      const response = await getAdminMenus();
      if (!response.data) throw new Error("메뉴 응답을 확인할 수 없습니다.");
      const server = response.data;
      setSnapshot(copy(server));
      setNodes((current) =>
        ordered([
          ...current,
          ...server.filter(
            (node) => !current.some((item) => item.menu_id === node.menu_id),
          ),
        ]),
      );
      setGroupRefreshPending(false);
      setMessage("묶음을 추가했습니다");
    } catch (failure) {
      setError(failure as Error);
    } finally {
      setBusy(false);
    }
  }

  function renderRow(node: AdminMenuNode, group: boolean) {
    const protectedUse = required(node) || node.children.some(required);
    const badName =
      invalidNames.includes(node.menu_id) ||
      (error instanceof ApiClientError && error.field?.includes("menu_name"));
    return (
      <tr
        key={node.menu_id}
        data-testid={`menu-row-${node.menu_id}`}
        className={group ? styles.group : styles.child}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (dragging.current) move(dragging.current, node.menu_id);
          dragging.current = null;
        }}
      >
        <td>
          <button
            type="button"
            data-testid={`menu-drag-${node.menu_id}`}
            draggable={!busy}
            disabled={busy}
            aria-label={`${node.menu_name} 순서 이동`}
            onDragStart={() => {
              dragging.current = node.menu_id;
            }}
            onDragEnd={() => {
              dragging.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                step(node, event.key === "ArrowUp" ? -1 : 1);
              }
            }}
          >
            ⠿
          </button>
        </td>
        <td>
          <input
            value={node.menu_name}
            data-testid={`menu-name-${node.menu_id}`}
            data-menu-name={node.menu_id}
            aria-label={`${node.screen_id ?? "묶음"} 메뉴 이름 ${node.menu_id}`}
            aria-invalid={!!badName}
            disabled={busy}
            onChange={(event) =>
              edit(node.menu_id, { menu_name: event.target.value })
            }
          />
          {badName && (
            <p className={styles.fieldError}>이름은 1~50자로 입력해 주세요.</p>
          )}
        </td>
        <td>{node.screen_id ?? ""}</td>
        <td>{node.sort_order}</td>
        <td>
          <input
            type="checkbox"
            data-testid={`menu-use-${node.menu_id}`}
            aria-label={`${node.menu_name} 사용`}
            title={
              protectedUse
                ? "필수 화면과 그 묶음은 사용 중지할 수 없습니다"
                : undefined
            }
            checked={node.use_yn === "Y"}
            disabled={busy || protectedUse}
            onChange={(event) =>
              edit(node.menu_id, { use_yn: event.target.checked ? "Y" : "N" })
            }
          />
        </td>
        <td>
          {!group && (
            <input
              type="checkbox"
              data-testid={`menu-mobile-${node.menu_id}`}
              aria-label={`${node.menu_name} 휴대폰 표시`}
              checked={node.mobile_yn === "Y"}
              disabled={busy}
              onChange={(event) =>
                edit(node.menu_id, {
                  mobile_yn: event.target.checked ? "Y" : "N",
                })
              }
            />
          )}
        </td>
        <td>{group && node.icon && <Icon name={node.icon} />}</td>
        <td>
          {!group && (
            <select
              data-testid={`menu-parent-${node.menu_id}`}
              aria-label={`${node.menu_name} 묶음 이동`}
              value={node.parent_menu_id ?? ""}
              disabled={busy}
              onChange={(event) => move(node.menu_id, event.target.value)}
            >
              {nodes.map((root) => (
                <option key={root.menu_id} value={root.menu_id}>
                  {root.menu_name}
                </option>
              ))}
            </select>
          )}
        </td>
      </tr>
    );
  }

  return (
    <section
      ref={container}
      className={styles.page}
      data-testid="menu-page"
      aria-label="메뉴 관리"
    >
      <div className={styles.toolbar}>
        <h2>메뉴 관리{dirty ? " ●" : ""}</h2>
        <Can perm="UI-25.create">
          <button
            type="button"
            data-testid="menu-add-group-button"
            disabled={busy || loading || !loaded}
            onClick={() => setDialog(true)}
          >
            + 묶음 추가
          </button>
        </Can>
      </div>
      <ErrorBanner
        error={error}
        onRetry={() => void retry()}
        retrying={busy || loading}
      />
      {error instanceof ApiClientError && error.field && (
        <p className={styles.fieldError}>항목: {error.field}</p>
      )}
      {message && (
        <p role="status" data-testid="menu-success-message">
          {message}
        </p>
      )}
      {loading && <p role="status">메뉴 읽는 중…</p>}
      {loaded && !loading && !nodes.length && (
        <div role="status">
          <p>메뉴 자료가 없습니다</p>
          <button
            data-testid="menu-empty-retry-button"
            onClick={() => void load()}
          >
            다시 읽기
          </button>
        </div>
      )}
      {loaded && nodes.length > 0 && (
        <Can perm="UI-25.read">
          <div className={styles.tableScroll}>
            <table aria-label="전체 메뉴 편집">
              <thead>
                <tr>
                  {[
                    "끌기",
                    "메뉴 이름",
                    "화면 ID",
                    "순서",
                    "사용",
                    "휴대폰",
                    "아이콘",
                    "묶음 이동",
                  ].map((text) => (
                    <th key={text} scope="col">
                      {text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.flatMap((node) => [
                  renderRow(node, true),
                  ...node.children.map((child) => renderRow(child, false)),
                ])}
              </tbody>
            </table>
          </div>
        </Can>
      )}
      <footer className={styles.actions}>
        <button
          type="button"
          data-testid="menu-cancel-button"
          disabled={busy || !dirty}
          onClick={() => {
            setNodes(copy(snapshot));
            setInvalidNames([]);
            setError(null);
            setMessage("");
          }}
        >
          취소
        </button>
        <Can perm="UI-25.update">
          <button
            type="button"
            data-testid="menu-save-button"
            className={styles.primary}
            disabled={
              busy ||
              loading ||
              !loaded ||
              refreshPending ||
              groupRefreshPending
            }
            onClick={() => void save()}
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </Can>
      </footer>
      {dialog && (
        <MenuGroupDialog
          onCancel={() => setDialog(false)}
          onCreated={groupCreated}
        />
      )}
    </section>
  );
}

export default Menu;
