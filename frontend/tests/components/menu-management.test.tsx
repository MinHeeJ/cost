import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Menu from "../../src/pages/menus/Menu";
import { menuGroupIcons, type AdminMenuNode } from "../../src/pages/menus/api";
import { useScreenTabs } from "../../src/pages/shared/tabs";

const request = vi.fn();
let server: AdminMenuNode[];
const row = (
  id: string,
  parent: string | null,
  screenId: string | null,
  name: string,
): AdminMenuNode => ({
  menu_id: id,
  parent_menu_id: parent,
  menu_name: name,
  screen_id: screenId,
  icon: parent === null ? "grid" : null,
  sort_order: 1,
  use_yn: "Y",
  mobile_yn: "Y",
  updated_at: "2026-10-14T09:00:00",
  updated_by: null,
  children: [],
});
const success = (data: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => ({ success: true, meta: {}, data }),
});
const failure = (
  status = 400,
  field: string | null = "menu_name",
  code = "400",
) => ({
  ok: false,
  status,
  headers: new Headers(),
  json: async () => ({
    success: false,
    meta: {},
    code,
    field,
    message: "입력 값을 확인해 주세요",
    requestId: "menu-request",
  }),
});

beforeEach(() => {
  useScreenTabs.getState().reset();
  useScreenTabs.getState().activate("/UI-25", "메뉴");
  const root = row("1", null, null, "시스템");
  root.children = [
    row("11", "1", "UI-25", "메뉴"),
    { ...row("12", "1", "UI-33", "다른 화면"), sort_order: 2 },
    { ...row("13", "1", "UI-12", "인력"), sort_order: 3 },
    { ...row("14", "1", "UI-16", "대시보드"), sort_order: 4 },
  ];
  server = [
    root,
    { ...row("2", null, null, "빈 묶음"), sort_order: 2, use_yn: "N" },
  ];
  request.mockReset();
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/api/admin/menus" && options?.method === "PUT") {
      const input = JSON.parse(options.body as string);
      server = input.map((group: AdminMenuNode) => ({
        ...server.find((item) => item.menu_id === group.menu_id),
        ...group,
        children: group.children.map((child: AdminMenuNode) => ({
          ...server
            .flatMap((item) => item.children)
            .find((item) => item.menu_id === child.menu_id),
          ...child,
        })),
      }));
      return success(structuredClone(server));
    }
    if (path === "/api/admin/menus/groups") {
      const input = JSON.parse(options?.body as string);
      const added = {
        ...row("9007199254740993", null, null, input.menu_name),
        icon: input.icon,
        sort_order: 3,
      };
      server.push(added);
      return success(added);
    }
    if (path === "/api/menus") {
      return success(
        server
          .filter((group) => group.use_yn === "Y")
          .map((group) => ({
            ...group,
            children: group.children.filter((child) => child.use_yn === "Y"),
          }))
          .filter((group) => group.children.length),
      );
    }
    return success(structuredClone(server));
  });
  vi.stubGlobal("fetch", request);
});

async function mount(onMenusChanged = vi.fn()) {
  const result = render(<Menu onMenusChanged={onMenusChanged} />);
  await screen.findByRole("table", { name: "전체 메뉴 편집" });
  return { ...result, onMenusChanged };
}
const count = (path: string, method?: string) =>
  request.mock.calls.filter(
    ([url, options]) => url === path && (!method || options?.method === method),
  ).length;

describe("메뉴 전체 트리 편집", () => {
  it("공개 조회에서 빈/비활성 묶음을 포함하고 필수 화면과 부모 사용을 잠근다", async () => {
    await mount();
    expect(screen.getByTestId("menu-name-2")).toHaveValue("빈 묶음");
    expect(screen.getByTestId("menu-use-2")).not.toBeChecked();
    expect(screen.getByTestId("menu-use-1")).toBeDisabled();
    expect(screen.getByTestId("menu-use-11")).toBeDisabled();
    expect(screen.getByTestId("menu-use-14")).toBeDisabled();
    expect(screen.queryByTestId("menu-mobile-1")).not.toBeInTheDocument();
    expect(request.mock.calls[0][1]?.headers).not.toHaveProperty(
      "Authorization",
    );
  });

  it("이름·사용·휴대폰·순서를 저장하고 정확한 writable payload와 탐색 재조회를 전달한다", async () => {
    const { onMenusChanged } = await mount();
    fireEvent.change(screen.getByTestId("menu-name-12"), {
      target: { value: "변경 화면" },
    });
    await userEvent.click(screen.getByTestId("menu-use-12"));
    await userEvent.click(screen.getByTestId("menu-mobile-13"));
    fireEvent.keyDown(screen.getByTestId("menu-drag-13"), { key: "ArrowUp" });
    expect(
      useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-25")
        ?.dirty,
    ).toBe(true);
    await userEvent.click(screen.getByTestId("menu-save-button"));
    await screen.findByText("메뉴를 저장했습니다");
    const [, options] = request.mock.calls.find(
      ([path, config]) =>
        path === "/api/admin/menus" && config.method === "PUT",
    )!;
    const payload = JSON.parse(options.body);
    expect(
      payload[0].children.map((node: AdminMenuNode) => node.menu_id),
    ).toEqual(["11", "13", "12", "14"]);
    expect(payload[0].children[1]).toMatchObject({
      mobile_yn: "N",
      sort_order: 2,
    });
    expect(payload[0].children[2]).toMatchObject({
      menu_name: "변경 화면",
      use_yn: "N",
      sort_order: 3,
    });
    expect(payload[0]).not.toHaveProperty("icon");
    expect(payload[0].children[0]).not.toHaveProperty("screen_id");
    expect(payload[0]).not.toHaveProperty("updated_by");
    expect(count("/api/menus")).toBe(1);
    expect(onMenusChanged).toHaveBeenCalledOnce();
    expect(
      onMenusChanged.mock.calls[0][0][0].children.some(
        (node: AdminMenuNode) => node.menu_id === "12",
      ),
    ).toBe(false);
    expect(
      useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-25")
        ?.dirty,
    ).toBe(false);
  });

  it("취소는 새 조회나 쓰기 없이 초안과 dirty를 복원한다", async () => {
    await mount();
    fireEvent.change(screen.getByTestId("menu-name-12"), {
      target: { value: "변경" },
    });
    await userEvent.click(screen.getByTestId("menu-cancel-button"));
    expect(screen.getByTestId("menu-name-12")).toHaveValue("다른 화면");
    expect(request).toHaveBeenCalledOnce();
    expect(
      useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-25")
        ?.dirty,
    ).toBe(false);
  });

  it("이름 길이 오류는 저장하지 않고 첫 입력에 초점을 둔다", async () => {
    await mount();
    fireEvent.change(screen.getByTestId("menu-name-12"), {
      target: { value: "" },
    });
    await userEvent.click(screen.getByTestId("menu-save-button"));
    expect(screen.getByTestId("menu-name-12")).toHaveFocus();
    expect(screen.getByTestId("menu-name-12")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(count("/api/admin/menus", "PUT")).toBe(0);
  });

  it.each([400, 409, 500])(
    "저장 %s 오류는 입력과 dirty와 문의 번호를 유지한다",
    async (status) => {
      await mount();
      const previous = request.getMockImplementation()!;
      request.mockImplementation(async (path, options) =>
        options?.method === "PUT"
          ? failure(
              status,
              status === 400 ? "menu_name" : null,
              status === 409 ? "MENU_REQUIRED" : String(status),
            )
          : previous(path, options),
      );
      fireEvent.change(screen.getByTestId("menu-name-12"), {
        target: { value: "유지 초안" },
      });
      await userEvent.click(screen.getByTestId("menu-save-button"));
      await screen.findByText("문의 번호: menu-request");
      expect(screen.getByTestId("menu-name-12")).toHaveValue("유지 초안");
      expect(
        useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-25")
          ?.dirty,
      ).toBe(true);
    },
  );

  it("PUT 성공 이후 탐색 오류 재시도는 PUT를 반복하지 않는다", async () => {
    await mount();
    const previous = request.getMockImplementation()!;
    let failed = false;
    request.mockImplementation(async (path, options) => {
      if (path === "/api/menus" && !failed) {
        failed = true;
        throw new TypeError("network");
      }
      return previous(path, options);
    });
    fireEvent.change(screen.getByTestId("menu-name-12"), {
      target: { value: "저장 완료" },
    });
    await userEvent.click(screen.getByTestId("menu-save-button"));
    await screen.findByRole("alert");
    expect(screen.getAllByText("서버 응답 없음").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("메뉴를 저장했습니다");
    expect(count("/api/admin/menus", "PUT")).toBe(1);
    expect(count("/api/menus")).toBe(2);
  });

  it("필수 화면을 비활성 묶음으로 이동하면 새 부모를 활성화하고 보호한다", async () => {
    await mount();
    fireEvent.change(screen.getByTestId("menu-parent-11"), {
      target: { value: "2" },
    });
    expect(screen.getByTestId("menu-use-2")).toBeChecked();
    expect(screen.getByTestId("menu-use-2")).toBeDisabled();
    expect(
      within(screen.getByTestId("menu-row-11")).getByRole("combobox"),
    ).toHaveValue("2");
    await userEvent.click(screen.getByTestId("menu-save-button"));
    await screen.findByText("메뉴를 저장했습니다");
    expect(server[1].children[0]).toMatchObject({
      menu_id: "11",
      parent_menu_id: "2",
      screen_id: "UI-25",
    });
  });

  it("드래그는 root 순서만 바꾸고 저장 전 DB 요청을 하지 않는다", async () => {
    await mount();
    fireEvent.dragStart(screen.getByTestId("menu-drag-2"));
    fireEvent.drop(screen.getByTestId("menu-row-1"));
    expect(screen.getAllByRole("row")[1]).toHaveAttribute(
      "data-testid",
      "menu-row-2",
    );
    expect(count("/api/admin/menus", "PUT")).toBe(0);
  });

  it("숨긴 업무 탭은 초안을 보존한다", async () => {
    const { container } = await mount();
    fireEvent.change(screen.getByTestId("menu-name-12"), {
      target: { value: "숨김 초안" },
    });
    container.hidden = true;
    container.hidden = false;
    expect(screen.getByTestId("menu-name-12")).toHaveValue("숨김 초안");
  });
});

describe("묶음 추가 작업 창", () => {
  it("10종 아이콘·이름 입력만 POST하고 기존 초안과 취소 기준의 새 ID를 함께 보존한다", async () => {
    await mount();
    fireEvent.change(screen.getByTestId("menu-name-12"), {
      target: { value: "기존 초안" },
    });
    await userEvent.click(screen.getByTestId("menu-add-group-button"));
    const dialog = screen.getByRole("dialog", { name: "묶음 추가" });
    expect(within(dialog).getByLabelText("이름 *")).toHaveFocus();
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual([...menuGroupIcons]);
    fireEvent.change(screen.getByTestId("menu-group-name-input"), {
      target: { value: "새 묶음" },
    });
    fireEvent.change(screen.getByTestId("menu-group-icon-select"), {
      target: { value: "folder" },
    });
    await userEvent.click(screen.getByTestId("menu-group-create-button"));
    await screen.findByText("묶음을 추가했습니다");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-name-12")).toHaveValue("기존 초안");
    expect(screen.getByTestId("menu-name-9007199254740993")).toHaveValue(
      "새 묶음",
    );
    const [, options] = request.mock.calls.find(
      ([path]) => path === "/api/admin/menus/groups",
    )!;
    expect(JSON.parse(options.body)).toEqual({
      menu_name: "새 묶음",
      icon: "folder",
    });
    expect(count("/api/admin/menus")).toBe(2);
    await userEvent.click(screen.getByTestId("menu-cancel-button"));
    expect(screen.getByTestId("menu-name-12")).toHaveValue("다른 화면");
    expect(screen.getByTestId("menu-name-9007199254740993")).toHaveValue(
      "새 묶음",
    );
  });

  it("서버 필드 오류는 모달·입력·문의번호·초점을 보존한다", async () => {
    await mount();
    const previous = request.getMockImplementation()!;
    request.mockImplementation(async (path, options) =>
      path === "/api/admin/menus/groups"
        ? failure(400, "menu_name")
        : previous(path, options),
    );
    await userEvent.click(screen.getByTestId("menu-add-group-button"));
    fireEvent.change(screen.getByTestId("menu-group-name-input"), {
      target: { value: "초안" },
    });
    await userEvent.click(screen.getByTestId("menu-group-create-button"));
    await screen.findByText("문의 번호: menu-request");
    expect(screen.getByTestId("menu-group-name-input")).toHaveValue("초안");
    expect(screen.getByTestId("menu-group-name-input")).toHaveFocus();
    expect(screen.getByTestId("menu-group-name-input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("빈 이름은 로컬 검증으로 차단하고 취소는 POST하지 않는다", async () => {
    await mount();
    await userEvent.click(screen.getByTestId("menu-add-group-button"));
    await userEvent.click(screen.getByTestId("menu-group-create-button"));
    expect(screen.getByTestId("menu-group-name-input")).toHaveFocus();
    expect(count("/api/admin/menus/groups")).toBe(0);
    await userEvent.click(screen.getByTestId("menu-group-cancel-button"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("메뉴 조회 상태", () => {
  it("빈 자료는 빈 안내와 읽기 재시도이고 가짜 메뉴를 만들지 않는다", async () => {
    request.mockResolvedValue(success([]));
    render(<Menu />);
    await screen.findByText("메뉴 자료가 없습니다");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("menu-empty-retry-button"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("처음 네트워크 실패는 저장 불가이고 재시도하면 실제 자료를 표시한다", async () => {
    request.mockRejectedValueOnce(new TypeError("network"));
    render(<Menu />);
    await screen.findByRole("alert");
    expect(screen.getByTestId("menu-save-button")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("table");
    expect(screen.getByTestId("menu-save-button")).toBeEnabled();
  });

  it("조회 대기에는 로딩 상태와 중복 동작 차단이 보인다", () => {
    request.mockImplementation(() => new Promise(() => {}));
    render(<Menu />);
    expect(screen.getByText("메뉴 읽는 중…")).toBeVisible();
    expect(screen.getByTestId("menu-save-button")).toBeDisabled();
    expect(screen.getByTestId("menu-add-group-button")).toBeDisabled();
  });
});
