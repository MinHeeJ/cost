import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import AppRouter, { screenRegistry } from "../../src/app/router";
import { menuScreens, type MenuNode } from "../../src/pages/shared/api";
import { useScreenTabs } from "../../src/pages/shared/tabs";
import { usePeriods } from "../../src/pages/shared/periods";
import { usePreferences } from "../../src/stores/preferences";
import menus from "../fixtures/shared-menus.json";

const fixture = menus as MenuNode[];
const request = vi.fn();
function Location() {
  return <output aria-label="현재 주소">{useLocation().pathname}</output>;
}
function mount(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppRouter />
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  usePreferences.getState().reload();
  useScreenTabs.getState().reset();
  usePeriods.getState().reset();
  vi.restoreAllMocks();
  request.mockReset();
  request.mockImplementation(async (path: string) => {
    const query = new URL(path, "https://test.invalid").searchParams;
    const data =
      path === "/api/menus"
        ? fixture
        : [{ close_month: query.get("from"), status: "OPEN" }];
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true, meta: {}, data }),
    };
  });
  vi.stubGlobal("fetch", request);
});

describe("공개 앱 route 연결", () => {
  it.each(screenRegistry)(
    "$route는 중복 shell 없이 API 메뉴의 업무 자리를 연다",
    async ({ route }) => {
      mount(route);
      const entry = menuScreens(fixture).find((item) => item.route === route)!;
      expect(
        await screen.findByRole("heading", { level: 1, name: entry.menu_name }),
      ).toBeVisible();
      expect(screen.getAllByRole("banner")).toHaveLength(1);
      expect(
        screen.getAllByRole("navigation", { name: "업무 메뉴" }),
      ).toHaveLength(1);
      expect(screen.getByLabelText("현재 주소")).toHaveTextContent(route);
      expect(request).toHaveBeenCalledWith("/api/menus", expect.anything());
      expect(screen.queryByText("로그인")).toBeNull();
    },
  );

  it("루트 진입은 대시보드로 redirect한다", async () => {
    mount("/");
    expect(
      await screen.findByRole("heading", { name: "대시보드", level: 1 }),
    ).toBeVisible();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-16");
  });

  it("메뉴 진입도 같은 Workspace와 선택한 route를 사용한다", async () => {
    mount("/UI-16");
    await screen.findByRole("heading", { name: "대시보드", level: 1 });
    const navigation = screen.getByRole("navigation", { name: "업무 메뉴" });
    await userEvent.click(
      within(navigation).getByRole("button", { name: "기준정보" }),
    );
    await userEvent.click(
      within(navigation).getByRole("button", { name: "개발자 풀" }),
    );
    expect(
      await screen.findByRole("heading", { name: "개발자 풀", level: 1 }),
    ).toBeVisible();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-02");
    expect(
      request.mock.calls.filter(([path]) => path === "/api/menus"),
    ).toHaveLength(1);
  });

  it("견본은 메뉴 row 없이 열리고 route 전환 시 dirty 입력 DOM을 보존한다", async () => {
    mount("/dev/components");
    const input = await screen.findByLabelText("이름·상호");
    await userEvent.type(input, "보존할 입력");
    expect(screen.queryByLabelText("화면 기간")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "대시보드" }));
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-16"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /공통 부품 견본/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소")).toHaveTextContent(
        "/dev/components",
      ),
    );
    expect(screen.getByLabelText("이름·상호")).toBe(input);
    expect(input).toHaveValue("보존할 입력");
    expect(
      request.mock.calls.filter(([path]) => path === "/api/menus"),
    ).toHaveLength(1);
  });

  it("모바일 PC전용 직접주소는 로그인 오류가 아닌 기기 안내로 연결한다", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    mount("/UI-14");
    expect(await screen.findByText("PC에서 이용해 주세요")).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "대시보드로" }));
    expect(
      await screen.findByRole("heading", { name: "대시보드", level: 1 }),
    ).toBeVisible();
  });

  it("미등록 주소를 업무 route로 위장하지 않는다", async () => {
    mount("/unknown");
    expect(await screen.findByText("등록된 화면이 없습니다.")).toBeVisible();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/unknown");
  });
});
