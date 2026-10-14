import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AppRouter from "../../src/app/router";
import { useScreenTabs } from "../../src/pages/shared/tabs";
import { usePeriods } from "../../src/pages/shared/periods";
import { usePreferences } from "../../src/stores/preferences";
import { useCodes as usePublicCodes } from "../../src/pages/apiops/useCodes";
import { useCodes as useMappingCodes } from "../../src/pages/excelmappings/useCodes";
import type { AdminCode, CodeGroup } from "../../src/pages/codegroups/api";
import type { AdminMenuNode } from "../../src/pages/menus/api";
import type { ExcelMapping } from "../../src/pages/excelmappings/api";
import menus from "../fixtures/shared-menus.json";

type MenuFixtureNode = Omit<
  AdminMenuNode,
  "use_yn" | "mobile_yn" | "updated_at" | "updated_by" | "children"
> & {
  use_yn: string;
  mobile_yn: string;
  children: MenuFixtureNode[];
};
function adminMenuFixture(node: MenuFixtureNode): AdminMenuNode {
  return {
    ...node,
    use_yn: node.use_yn === "Y" ? "Y" : "N",
    mobile_yn: node.mobile_yn === "Y" ? "Y" : "N",
    updated_at: "2026-10-01T00:00:00Z",
    updated_by: null,
    children: node.children.map(adminMenuFixture),
  };
}

const request = vi.fn();
let menuRows: AdminMenuNode[];
let codes: AdminCode[];
let mappings: ExcelMapping[];
const group: CodeGroup = {
  group_code: "JOB",
  group_name: "직무",
  group_kind: "BIZ",
  attr1_label: null,
  attr2_label: null,
  attr3_label: null,
  sort_order: 1,
  use_yn: "Y",
  code_count: 1,
};
const success = (data: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => ({ success: true, meta: {}, data: structuredClone(data) }),
});
const historyCount = () =>
  request.mock.calls.filter(([path]) =>
    String(path).startsWith("/api/admin/code-history?"),
  ).length;
const dirty = () =>
  useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-27")?.dirty;
function mount(route = "/UI-27") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppRouter />
    </MemoryRouter>,
  );
}
async function panel(name: string) {
  await userEvent.click(screen.getByRole("tab", { name }));
}

beforeEach(() => {
  localStorage.clear();
  usePreferences.getState().reload();
  useScreenTabs.getState().reset();
  usePeriods.getState().reset();
  vi.restoreAllMocks();
  request.mockReset();
  menuRows = structuredClone(menus).map(adminMenuFixture);
  codes = [
    {
      group_code: "JOB",
      code: "BE",
      code_name: "개발",
      attr1: null,
      attr2: null,
      attr3: null,
      sort_order: 1,
      use_yn: "Y",
      effective_from: null,
    },
  ];
  mappings = [
    {
      excel_label: "개발자",
      target_group: "JOB",
      target_code: "BE",
      group_name: "직무",
      code_name: "개발",
      map_role: "MAIN",
      note: "기존 메모",
      use_yn: "Y",
    },
  ];
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/api/menus")
      return success(
        menuRows
          .filter((root) => root.use_yn === "Y")
          .map((root) => ({
            ...root,
            children: root.children.filter((child) => child.use_yn === "Y"),
          }))
          .filter((root) => root.children.length),
      );
    if (path === "/api/admin/menus") {
      if (options?.method === "PUT") {
        const input = JSON.parse(String(options.body)) as AdminMenuNode[];
        menuRows = input.map((root) => ({
          ...menuRows.find((row) => row.menu_id === root.menu_id),
          ...root,
          children: root.children.map((child) => ({
            ...menuRows
              .flatMap((row) => row.children)
              .find((row) => row.menu_id === child.menu_id),
            ...child,
          })),
        }));
      }
      return success(menuRows);
    }
    if (path === "/api/admin/code-groups") return success([group]);
    if (path === "/api/admin/code-groups/JOB/codes") {
      if (options?.method === "PUT") codes = JSON.parse(String(options.body));
      return success(codes);
    }
    if (path.startsWith("/api/admin/excel-mappings")) {
      if (options?.method === "PATCH") {
        mappings[0] = { ...mappings[0], ...JSON.parse(String(options.body)) };
        return success(mappings[0]);
      }
      return success(mappings);
    }
    if (path.startsWith("/api/admin/code-history?"))
      return success({ items: [], total: 0, page: 1, size: 50 });
    if (path === "/api/admin/params") return success([]);
    if (path.startsWith("/api/codes/"))
      return success(
        codes
          .filter((code) => code.use_yn === "Y")
          .map((code) => ({ code: code.code, name: code.code_name })),
      );
    throw new Error(`Unexpected test request: ${path}`);
  });
  vi.stubGlobal("fetch", request);
});

describe("관리 화면 통합 탐색", () => {
  it("기존 시스템 메뉴에서 네 탭을 열고 숨겨진 코드 입력과 shell dirty를 보존한다", async () => {
    mount("/UI-16");
    await screen.findByRole("heading", { level: 1, name: "대시보드" });
    const navigation = within(
      screen.getByRole("navigation", { name: "업무 메뉴" }),
    );
    await userEvent.click(navigation.getByRole("button", { name: "시스템" }));
    await userEvent.click(navigation.getByRole("button", { name: "공통코드" }));
    const input = await screen.findByLabelText("이름 1");
    await userEvent.clear(input);
    await userEvent.type(input, "편집 중");
    await waitFor(() => expect(dirty()).toBe(true));
    await panel("엑셀 표기 대응");
    expect(screen.getByTestId("excel-mappings-panel")).toBeVisible();
    expect(input).not.toBeVisible();
    await panel("기준값");
    expect(screen.getByTestId("params-panel")).toBeVisible();
    await panel("변경 이력");
    expect(screen.getByTestId("code-history-panel")).toBeVisible();
    await panel("코드");
    expect(screen.getByLabelText("이름 1")).toBe(input);
    expect(input).toHaveValue("편집 중");
    await userEvent.click(screen.getByRole("tab", { name: "대시보드" }));
    await userEvent.click(screen.getByRole("tab", { name: /공통코드/ }));
    expect(input).toHaveValue("편집 중");
    expect(dirty()).toBe(true);
    expect(screen.queryByLabelText("화면 기간")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
  });

  it("한 패널의 취소나 저장은 다른 패널 dirty를 지우지 않고 저장 후 이력을 재조회한다", async () => {
    mount();
    const codeName = await screen.findByLabelText("이름 1");
    await userEvent.type(codeName, " 수정");
    await panel("엑셀 표기 대응");
    const mappingPanel = within(screen.getByTestId("excel-mappings-panel"));
    const note = mappingPanel.getByRole("textbox");
    await userEvent.type(note, " 수정");
    await panel("코드");
    await userEvent.click(screen.getByTestId("code-cancel-button"));
    expect(codeName).toHaveValue("개발");
    await waitFor(() => expect(dirty()).toBe(true));
    await panel("엑셀 표기 대응");
    expect(mappingPanel.getByRole("textbox")).toBe(note);
    const count = historyCount();
    await userEvent.click(mappingPanel.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(historyCount()).toBeGreaterThan(count));
    await waitFor(() => expect(dirty()).toBe(false));
    expect(mappings[0].note).toBe("기존 메모 수정");
    await panel("코드");
    await userEvent.type(codeName, " 저장");
    const afterMapping = historyCount();
    await userEvent.click(screen.getByTestId("code-save-button"));
    await waitFor(() => expect(historyCount()).toBeGreaterThan(afterMapping));
    await waitFor(() => expect(dirty()).toBe(false));
  });

  it("메뉴 저장 결과의 이름·활성 상태를 reload 없이 Sidebar에 반영하고 입력 DOM을 유지한다", async () => {
    mount("/UI-25");
    await screen.findByRole("table", { name: "전체 메뉴 편집" });
    const candidate = menuRows
      .flatMap((root) => root.children)
      .find((row) => row.screen_id === "UI-33")!;
    const input = screen.getByTestId(`menu-name-${candidate.menu_id}`);
    await userEvent.clear(input);
    await userEvent.type(input, "변경된 후보");
    await userEvent.click(screen.getByTestId("menu-save-button"));
    await screen.findByText("메뉴를 저장했습니다");
    const navigation = within(
      screen.getByRole("navigation", { name: "업무 메뉴" }),
    );
    const groupName = menuRows.find((root) =>
      root.children.some((row) => row.menu_id === candidate.menu_id),
    )!.menu_name;
    await userEvent.click(navigation.getByRole("button", { name: groupName }));
    expect(
      navigation.getByRole("button", { name: "변경된 후보" }),
    ).toBeVisible();
    await userEvent.click(screen.getByTestId(`menu-use-${candidate.menu_id}`));
    await userEvent.click(screen.getByTestId("menu-save-button"));
    await waitFor(() =>
      expect(
        navigation.queryByRole("button", { name: "변경된 후보" }),
      ).toBeNull(),
    );
    expect(screen.getByTestId(`menu-name-${candidate.menu_id}`)).toBe(input);
    expect(screen.getByTestId(`menu-row-${candidate.menu_id}`)).toBeVisible();
    expect(
      request.mock.calls.filter(([path]) => path === "/api/menus"),
    ).toHaveLength(3);
  });

  it.each(["/UI-25", "/UI-27"])(
    "375px에서 %s는 기존 PC 안내를 유지한다",
    async (route) => {
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);
      mount(route);
      expect(await screen.findByText("PC에서 이용해 주세요")).toBeVisible();
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
      const navigation = within(
        screen.getByRole("navigation", { name: "업무 메뉴" }),
      );
      expect(navigation.queryByRole("button", { name: "메뉴" })).toBeNull();
      expect(navigation.queryByRole("button", { name: "공통코드" })).toBeNull();
    },
  );

  it("기준값 저장은 숨겨진 이력을 재조회하고 코드 초안 dirty는 그대로 유지한다", async () => {
    const fallback = request.getMockImplementation()!;
    const param = {
      param_key: "VAT_RATE",
      effective_from: "2000-01",
      param_name: "부가세율",
      num_value: 10,
      text_value: null,
      unit: "%",
      used_in: "계약",
    };
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/admin/params") return success([param]);
      if (path.startsWith("/api/month-close?"))
        return success([{ close_month: "2026-09", status: "CLOSED" }]);
      if (path === "/api/admin/params/VAT_RATE" && options?.method === "PUT") {
        return success({ ...param, ...JSON.parse(String(options.body)) });
      }
      return fallback(path, options);
    });
    mount();
    const codeName = await screen.findByLabelText("이름 1");
    await userEvent.type(codeName, " 초안");
    await panel("기준값");
    await userEvent.click(screen.getByTestId("param-edit-vat-rate"));
    const dialog = within(screen.getByRole("dialog", { name: "값 변경" }));
    await userEvent.clear(dialog.getByLabelText("새 값"));
    await userEvent.type(dialog.getByLabelText("새 값"), "11");
    await waitFor(() =>
      expect(dialog.getByLabelText("적용 시작월")).not.toBeDisabled(),
    );
    fireEvent.change(dialog.getByLabelText("적용 시작월"), {
      target: { value: "2026-11" },
    });
    const before = historyCount();
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(historyCount()).toBeGreaterThan(before));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "값 변경" })).toBeNull(),
    );
    expect(dirty()).toBe(true);
    await panel("코드");
    expect(codeName).toHaveValue("개발 초안");
    await userEvent.click(screen.getByTestId("code-cancel-button"));
    await waitFor(() => expect(dirty()).toBe(false));
  });

  it("거부된 코드 저장은 입력·dirty·문의번호를 보존하고 성공 이력 갱신을 하지 않는다", async () => {
    const fallback = request.getMockImplementation()!;
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === "PUT")
        return {
          ok: false,
          status: 409,
          headers: new Headers(),
          json: async () => ({
            success: false,
            meta: {},
            code: "DUPLICATE_CODE",
            field: "code",
            message: "중복 코드입니다.",
            requestId: "admin-inquiry",
          }),
        };
      return fallback(path, options);
    });
    mount();
    const input = await screen.findByLabelText("이름 1");
    await userEvent.type(input, " 초안");
    const before = historyCount();
    await userEvent.click(screen.getByTestId("code-save-button"));
    expect(await screen.findByText("문의 번호: admin-inquiry")).toBeVisible();
    expect(input).toHaveValue("개발 초안");
    expect(dirty()).toBe(true);
    expect(historyCount()).toBe(before);
    expect(screen.queryByTestId("code-save-success")).toBeNull();
  });

  it.each([usePublicCodes, useMappingCodes])(
    "활성 옵션은 해당 그룹 저장 이벤트만 재조회하고 구독을 해제한다",
    async (hook) => {
      const view = renderHook(() => hook("JOB"));
      await waitFor(() => expect(view.result.current.codes).toHaveLength(1));
      const count = request.mock.calls.length;
      act(() =>
        window.dispatchEvent(
          new CustomEvent("common-code-options-changed", {
            detail: { group: "OTHER" },
          }),
        ),
      );
      expect(request.mock.calls).toHaveLength(count);
      codes[0].use_yn = "N";
      act(() =>
        window.dispatchEvent(
          new CustomEvent("common-code-options-changed", {
            detail: { group: "JOB" },
          }),
        ),
      );
      await waitFor(() => expect(view.result.current.codes).toEqual([]));
      expect(request.mock.calls).toHaveLength(count + 1);
      view.unmount();
      act(() =>
        window.dispatchEvent(
          new CustomEvent("common-code-options-changed", {
            detail: { group: "JOB" },
          }),
        ),
      );
      expect(request.mock.calls).toHaveLength(count + 1);
    },
  );
});
