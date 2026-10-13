import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../../src/app/App";
import Header from "../../src/layout/Header";
import TitleBar from "../../src/layout/TitleBar";
import RecentScreens from "../../src/layout/RecentScreens";
import { usePreferences } from "../../src/stores/preferences";

beforeEach(() => {
  localStorage.clear();
  usePreferences.getState().reload();
});
function Location() {
  return <output aria-label="현재 주소">{useLocation().pathname}</output>;
}

describe("공개 shell", () => {
  it("로그인 없이 직접 주소에 shell과 자식 상태를 표시한다", () => {
    render(
      <MemoryRouter initialEntries={["/UI-03"]}>
        <App title="공개 화면" screenId="UI-03">
          <input aria-label="입력" defaultValue="보존" />
        </App>
        <Location />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "공개 화면",
    );
    expect(screen.getByText("UI-03")).toBeVisible();
    expect(screen.getByLabelText("입력")).toHaveValue("보존");
    expect(screen.queryByText("로그인")).not.toBeInTheDocument();
  });
  it("로고는 대시보드로 이동하며 기간은 헤더에 없다", async () => {
    render(
      <MemoryRouter initialEntries={["/UI-03"]}>
        <Header onToggleMenu={() => {}} />
        <Location />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("link", { name: "프로젝트·원가 관리" }),
    );
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-16");
    expect(
      screen.getByRole("banner").querySelector('input[type="month"]'),
    ).toBeNull();
  });
  it("알림은 실제 빈 상태이며 계정/로그아웃을 추가하지 않는다", async () => {
    render(
      <MemoryRouter>
        <Header onToggleMenu={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "알림" }));
    expect(screen.getByRole("status")).toHaveTextContent("새 알림이 없습니다");
    expect(screen.queryByText("로그아웃")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("사용자 메뉴의 건수와 좁게 보기 설정은 저장된다", async () => {
    render(
      <MemoryRouter>
        <Header onToggleMenu={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /기본 사용자/ }));
    await userEvent.selectOptions(
      screen.getByLabelText("목록 기본 건수"),
      "20",
    );
    await userEvent.click(screen.getByLabelText("좁게 보기"));
    expect(localStorage.getItem("si.pageSize")).toBe("20");
    expect(localStorage.getItem("si.compact")).toBe("true");
  });
  it("제목줄은 묶음·제목·ID·즐겨찾기 동작과 버튼 영역을 제공한다", async () => {
    const favorite = vi.fn();
    render(
      <TitleBar
        title="화면"
        group="묶음"
        screenId="UI-03"
        onToggleFavorite={favorite}
      />,
    );
    expect(screen.getByText("묶음 › 화면")).toBeVisible();
    expect(screen.getByRole("heading")).toHaveTextContent("화면");
    await userEvent.click(screen.getByRole("button", { name: "즐겨찾기" }));
    expect(favorite).toHaveBeenCalledOnce();
  });
  it("최근 화면 선택은 공통 진입 콜백으로 전달된다", async () => {
    const item = { screenId: "UI-03", name: "최근 화면", route: "/UI-03" };
    usePreferences.getState().recordRecent(item);
    const navigate = vi.fn();
    render(<RecentScreens onNavigate={navigate} />);
    await userEvent.click(screen.getByRole("button", { name: "최근 화면" }));
    expect(navigate).toHaveBeenCalledWith(item);
  });
  it("태블릿 메뉴 펼침은 PC 접힘 설정을 뒤집지 않는다", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(max-width: 1279px)",
        }) as MediaQueryList,
    );
    render(
      <MemoryRouter initialEntries={["/UI-03"]}>
        <App sidebar={<p>태블릿 탐색</p>} />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "메뉴 열기/접기" }),
    );
    expect(usePreferences.getState().menuCollapsed).toBe(false);
    expect(
      screen.getByText("태블릿 탐색").closest("aside")?.parentElement
        ?.className,
    ).toContain("tabletExpanded");
    await userEvent.click(
      screen.getByRole("button", { name: "메뉴 열기/접기" }),
    );
    expect(
      screen.getByText("태블릿 탐색").closest("aside")?.parentElement
        ?.className,
    ).not.toContain("tabletExpanded");
    vi.restoreAllMocks();
  });
  it("메뉴 버튼은 모바일 열기와 데스크톱 접힘을 구분한다", async () => {
    render(
      <MemoryRouter initialEntries={["/UI-03"]}>
        <App sidebar={<p>탐색</p>} />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "메뉴 열기/접기" }),
    );
    expect(usePreferences.getState().menuCollapsed).toBe(true);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    await userEvent.click(
      screen.getByRole("button", { name: "메뉴 열기/접기" }),
    );
    expect(usePreferences.getState().menuCollapsed).toBe(true);
    expect(screen.getByText("탐색").closest("aside")?.className).toContain(
      "mobileOpen",
    );
    vi.restoreAllMocks();
  });
});
