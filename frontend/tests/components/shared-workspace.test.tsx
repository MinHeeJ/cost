import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import Workspace from "../../src/pages/shared/Workspace";
import {
  Components,
  amountError,
  mmError,
} from "../../src/pages/shared/Components";
import { PeriodBar } from "../../src/pages/shared/PeriodBar";
import { menuScreens, type MenuNode } from "../../src/pages/shared/api";
import { screenRegistry } from "../../src/pages/shared/registry";
import {
  ScreenSearch,
  Sidebar,
  UnsavedChangesBoundary,
} from "../../src/pages/shared/Navigation";
import { useScreenTabs } from "../../src/pages/shared/tabs";
import { usePeriods } from "../../src/pages/shared/periods";
import { usePreferences } from "../../src/stores/preferences";
import menus from "../fixtures/shared-menus.json";

const fixture = menus as MenuNode[];
function Location() {
  return <output aria-label="현재 주소">{useLocation().pathname}</output>;
}
function mount(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Workspace />
      <Location />
    </MemoryRouter>,
  );
}
function success(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ success: true, meta: {}, data }),
  };
}
const request = vi.fn();
beforeEach(() => {
  localStorage.clear();
  usePreferences.getState().reload();
  useScreenTabs.getState().reset();
  usePeriods.getState().reset();
  vi.restoreAllMocks();
  request.mockReset();
  request.mockImplementation(async (path: string) => {
    if (path === "/api/menus") return success(fixture);
    if (path === "/api/admin/menus") return success(fixture);
    if (path.startsWith("/api/admin/code-history")) {
      return success({ items: [], total: 0, page: 1, size: 50 });
    }
    if (path.startsWith("/api/admin/")) return success([]);
    const query = new URL(path, "https://test.invalid").searchParams;
    return success([
      {
        close_month: query.get("from"),
        status: query.get("from") === "2026-09" ? "CLOSED" : "OPEN",
      },
    ]);
  });
  vi.stubGlobal("fetch", request);
});

describe("개선된 조회 상태", () => {
  it("메뉴 하단 접기 버튼은 설정을 바꾸고 펼치기로 복원한다", async () => {
    mount("/UI-01");
    await screen.findByRole("heading", { name: "프로젝트" });
    await userEvent.click(screen.getByRole("button", { name: "메뉴 접기" }));
    expect(usePreferences.getState().menuCollapsed).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "메뉴 펼치기" }));
    expect(usePreferences.getState().menuCollapsed).toBe(false);
  });
  it("요청한 화면의 메뉴가 없으면 대시보드로 잘못 표시하지 않는다", async () => {
    request.mockResolvedValue(
      success(
        fixture.filter(
          (group) => !group.children.some((item) => item.screen_id === "UI-03"),
        ),
      ),
    );
    mount("/UI-03");
    expect(
      await screen.findByText("이 화면의 메뉴 정보를 찾을 수 없습니다."),
    ).toBeVisible();
    expect(
      screen.getByText("이 화면은 다음 단계에서 만듭니다."),
    ).not.toBeVisible();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-03");
  });
  it("월 응답이 비어도 OPEN을 꾸미지 않고 재조회한다", async () => {
    request.mockResolvedValue(success([]));
    render(<PeriodBar screenId="UI-19" type="MONTH" />);
    expect(
      await screen.findByText("선택한 월의 마감 상태가 없습니다."),
    ).toBeVisible();
    expect(screen.queryByText("작업중")).toBeNull();
    request.mockResolvedValue(
      success([{ close_month: "2026-10", status: "OPEN" }]),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "마감 상태 다시 읽기" }),
    );
    expect(await screen.findByText("작업중")).toBeVisible();
  });
  it("닫기 확인에서 Esc는 입력과 탭을 보존한다", async () => {
    mount("/dev/components");
    await screen.findByLabelText("이름·상호");
    await userEvent.type(screen.getByLabelText("이름·상호"), "보존");
    act(() => useScreenTabs.getState().close("/dev/components"));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("이름·상호")).toHaveValue("보존");
  });
});

describe("공유 업무 자리", () => {
  it.each(screenRegistry)(
    "$route 공개 직접주소는 API 이름과 해당 기간 및 자리 안내를 표시한다",
    async (definition) => {
      mount(definition.route);
      const entry = menuScreens(fixture).find(
        (item) => item.route === definition.route,
      )!;
      expect(
        await screen.findByRole("heading", { level: 1, name: entry.menu_name }),
      ).toBeVisible();
      expect(
        screen.getByText(definition.screenId, { selector: "span" }),
      ).toBeVisible();
      if (definition.route === "/UI-25") {
        expect(
          await screen.findByRole("table", { name: "전체 메뉴 편집" }),
        ).toBeVisible();
        expect(request).toHaveBeenCalledWith(
          "/api/admin/menus",
          expect.anything(),
        );
        expect(screen.queryByLabelText("화면 기간")).toBeNull();
        return;
      }
      if (definition.route === "/UI-27") {
        expect(await screen.findByTestId("common-code-page")).toBeVisible();
        await userEvent.click(screen.getByRole("tab", { name: "기준값" }));
        expect(
          await screen.findByText("현재 적용 가능한 기준값이 없습니다."),
        ).toBeVisible();
        expect(screen.getByTestId("params-panel")).toBeVisible();
        expect(
          within(screen.getByTestId("params-panel")).queryByLabelText(
            "화면 기간",
          ),
        ).toBeNull();
        expect(request).toHaveBeenCalledWith(
          "/api/admin/params",
          expect.anything(),
        );
        expect(screen.queryByText("로그인")).not.toBeInTheDocument();
        return;
      }
      expect(
        screen
          .getAllByText("이 화면은 다음 단계에서 만듭니다.")
          .some((item) => !item.closest("[hidden]")),
      ).toBe(true);
      const activePanel = screen
        .getAllByText("이 화면은 다음 단계에서 만듭니다.")
        .find((item) => !item.closest("[hidden]"))!.parentElement!;
      if (definition.periodType === "NONE")
        expect(within(activePanel).queryByLabelText("화면 기간")).toBeNull();
      else
        expect(within(activePanel).getByLabelText("화면 기간")).toBeVisible();
      expect(request).toHaveBeenCalledWith("/api/menus", expect.anything());
      expect(screen.queryByText("로그인")).not.toBeInTheDocument();
    },
  );
  it("루트는 고정 대시보드로 이동한다", async () => {
    mount("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "대시보드" }),
    ).toBeVisible();
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-16");
  });
  it("견본 직접주소는 API 메뉴 row 없이 열린다", async () => {
    mount("/dev/components");
    expect(
      await screen.findByRole("heading", { level: 1, name: "공통 부품 견본" }),
    ).toBeVisible();
    expect(screen.getByLabelText("이름·상호")).toBeVisible();
    expect(screen.getByText("총 118건 · 단위: 원 (합성 예시)")).toBeVisible();
    expect(screen.queryByLabelText("화면 기간")).not.toBeInTheDocument();
    expect(
      menuScreens(fixture).some((item) => item.route === "/dev/components"),
    ).toBe(false);
  });
  it("메뉴 오류 후 retry는 기존 화면 입력을 유지하고 서버 문의번호를 표시한다", async () => {
    mount("/dev/components");
    await screen.findByLabelText("이름·상호");
    await userEvent.type(screen.getByLabelText("이름·상호"), "유지");
    // A period error is a real same-origin API failure and must not clear the mounted form.
    request.mockImplementation(async () => ({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({
        success: false,
        meta: {},
        code: "500",
        message: "서버 오류",
        field: null,
        requestId: "server-id",
      }),
    }));
    render(<PeriodBar screenId="UI-19" type="MONTH" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "문의 번호: server-id",
    );
    expect(screen.getByLabelText("이름·상호")).toHaveValue("유지");
    request.mockResolvedValue(
      success([{ close_month: "2026-10", status: "OPEN" }]),
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByLabelText("이름·상호")).toHaveValue("유지");
    expect(screen.queryByText("로컬 견본 조작을 완료했습니다.")).toBeNull();
  });
  it("메뉴 연결실패는 임의 번호 없이 표시하며 retry로 실제 목록을 복구한다", async () => {
    request.mockRejectedValue(new TypeError("offline"));
    mount("/UI-03");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "서버 응답 없음",
    );
    expect(screen.queryByText(/문의 번호:/)).toBeNull();
    request.mockResolvedValue(success(fixture));
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "개인 원가·수익표",
      }),
    ).toBeVisible();
  });
  it("메뉴 빈 목록은 재조회 동작을 제공한다", async () => {
    request.mockResolvedValue(success([]));
    mount("/UI-16");
    expect(await screen.findByText("사용 메뉴가 없습니다.")).toBeVisible();
    request.mockResolvedValue(success(fixture));
    await userEvent.click(screen.getByRole("button", { name: "다시 읽기" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "대시보드" }),
    ).toBeVisible();
  });
  it.each(["UI-10", "UI-20", "UI-14", "UI-27", "UI-23", "UI-24", "UI-25"])(
    "휴대폰 %s 직접 접근은 기기 안내와 대시보드로만 제공한다",
    async (id) => {
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);
      mount(`/${id}`);
      expect(await screen.findByText("PC에서 이용해 주세요")).toBeVisible();
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "대시보드로" }));
      expect(
        await screen.findByRole("heading", { level: 1, name: "대시보드" }),
      ).toBeVisible();
    },
  );
  it("휴대폰 메뉴에서 PC전용 7개를 숨기지만 지원 화면은 같은 진입 콜백을 사용한다", async () => {
    const activate = vi.fn();
    render(
      <Sidebar menus={fixture} mobile active="/UI-16" onActivate={activate} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "재무·자금" }));
    expect(screen.queryByRole("button", { name: "재무 항목" })).toBeNull();
    expect(screen.queryByRole("button", { name: "월 마감" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "전체 수익 구조" }),
    );
    expect(activate).toHaveBeenCalledWith("/UI-07", "전체 수익 구조");
  });
});

describe("공통 탐색과 상태 보존", () => {
  it("기존 탭 재선택은 중복 없이 상태를 보존하고 dirty 이동은 확인하지 않는다", () => {
    const state = useScreenTabs.getState();
    state.activate("/dev/components", "견본");
    state.setDirty("/dev/components", true);
    state.activate("/UI-03", "원가");
    state.activate("/dev/components", "견본");
    expect(useScreenTabs.getState().tabs).toHaveLength(3);
    expect(
      useScreenTabs
        .getState()
        .tabs.find((item) => item.route === "/dev/components")?.dirty,
    ).toBe(true);
    expect(useScreenTabs.getState().pending).toBeNull();
  });
  it("9번째 화면은 dashboard 제외 LRU를 확인 전 제거하지 않으며 취소는 방문상태까지 불변", () => {
    const state = useScreenTabs.getState();
    for (let index = 0; index < 7; index++)
      state.activate(`/screen-${index}`, `화면 ${index}`);
    state.setDirty("/screen-0", true);
    const before = structuredClone(useScreenTabs.getState().tabs);
    const active = useScreenTabs.getState().active;
    state.activate("/screen-7", "추가");
    expect(useScreenTabs.getState().pending?.remove).toBe("/screen-0");
    expect(useScreenTabs.getState().tabs).toEqual(before);
    state.cancel();
    expect(useScreenTabs.getState().active).toBe(active);
    expect(useScreenTabs.getState().tabs).toEqual(before);
    state.activate("/screen-7", "추가");
    state.confirm();
    expect(useScreenTabs.getState().tabs).toHaveLength(8);
    expect(
      useScreenTabs.getState().tabs.some((item) => item.route === "/UI-16"),
    ).toBe(true);
    expect(
      useScreenTabs.getState().tabs.some((item) => item.route === "/screen-0"),
    ).toBe(false);
  });
  it("대시보드는 닫기 불가이고 깨끗한 탭 닫기는 확인이 없다", () => {
    const state = useScreenTabs.getState();
    state.close("/UI-16");
    expect(useScreenTabs.getState().tabs).toHaveLength(1);
    state.activate("/UI-03", "원가");
    state.close("/UI-03");
    expect(useScreenTabs.getState().pending).toBeNull();
    expect(useScreenTabs.getState().active).toBe("/UI-16");
  });
  it("dirty 탭 닫기는 원문 확인, 계속 작성은 입력 유지, 나가기는 실제 제거", async () => {
    mount("/dev/components");
    await screen.findByLabelText("이름·상호");
    await userEvent.type(screen.getByLabelText("이름·상호"), "유지할 내용");
    const close = () =>
      act(() => useScreenTabs.getState().close("/dev/components"));
    close();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "저장하지 않은 내용이 있습니다. 나가면 사라집니다.",
    );
    await userEvent.click(screen.getByRole("button", { name: "계속 작성" }));
    expect(screen.getByLabelText("이름·상호")).toHaveValue("유지할 내용");
    close();
    await userEvent.click(screen.getByRole("button", { name: "나가기" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("이름·상호")).toBeNull(),
    );
    expect(screen.getByLabelText("현재 주소")).toHaveTextContent("/UI-16");
  });
  it("dirty 탭 전환 후 돌아와도 같은 DOM 입력을 유지한다", async () => {
    mount("/dev/components");
    await screen.findByLabelText("이름·상호");
    await userEvent.type(screen.getByLabelText("이름·상호"), "돌아올 내용");
    const input = screen.getByLabelText("이름·상호");
    await userEvent.click(screen.getByRole("tab", { name: "대시보드" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /공통 부품 견본/ }));
    expect(screen.getByLabelText("이름·상호")).toBe(input);
    expect(input).toHaveValue("돌아올 내용");
  });
  it("beforeunload는 dirty에서만 막고 저장 후 해제된다", () => {
    render(<UnsavedChangesBoundary />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    act(() => {
      useScreenTabs.getState().activate("/dev/components", "견본");
      useScreenTabs.getState().setDirty("/dev/components", true);
    });
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    act(() => useScreenTabs.getState().setDirty("/dev/components", false));
    const saved = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });
  it("Ctrl+K 검색 trim/부분일치와 Esc 및 공통 activation을 사용한다", async () => {
    const activate = vi.fn();
    render(
      <ScreenSearch screens={menuScreens(fixture)} onActivate={activate} />,
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await userEvent.type(
      screen.getByLabelText("화면 이름 검색어"),
      " 개인 원가 ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "개인 원가·수익표" }),
    );
    expect(activate).toHaveBeenCalledWith("/UI-03", "개인 원가·수익표");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await userEvent.type(
      screen.getByLabelText("화면 이름 검색어"),
      "없는 이름",
    );
    expect(screen.getByText("검색 결과가 없습니다.")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("즐겨찾기 11번째는 거부하고 최근 중복 MRU는 최대5개로 저장한다", () => {
    const state = usePreferences.getState();
    const ids = menuScreens(fixture)
      .slice(0, 10)
      .map((item) => item.screen_id!);
    expect(state.setFavorites(ids)).toBe(true);
    expect(state.setFavorites([...ids, "UI-27"])).toBe(false);
    expect(usePreferences.getState().favorites).toEqual(ids);
    for (const item of menuScreens(fixture).slice(0, 6)) {
      state.recordRecent({
        screenId: item.screen_id!,
        name: item.menu_name,
        route: item.route,
      });
    }
    const first = usePreferences.getState().recentScreens[2];
    state.recordRecent(first);
    expect(usePreferences.getState().recentScreens).toHaveLength(5);
    expect(usePreferences.getState().recentScreens[0]).toEqual(first);
    state.reload();
    expect(usePreferences.getState().favorites).toEqual(ids);
  });
});

describe("기간과 견본 입력", () => {
  it("기간은 화면별 세션 상태이고 월 조회는 선택값에서 만든 relative API만 사용한다", async () => {
    usePeriods.getState().setPeriod("UI-19", { year: 2026, month: 9 });
    render(<PeriodBar screenId="UI-19" type="MONTH" />);
    expect(await screen.findByText("마감")).toBeVisible();
    expect(request).toHaveBeenCalledWith(
      "/api/month-close?from=2026-09&to=2026-09",
      expect.anything(),
    );
    await userEvent.click(screen.getByRole("button", { name: "확인했음" }));
    expect(
      screen.getByText("마감된 달입니다. 수정·삭제할 수 없습니다."),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("연월"), {
      target: { value: "2026-10" },
    });
    expect(await screen.findByText("작업중")).toBeVisible();
    expect(usePeriods.getState().periods["UI-19"]).toEqual({
      year: 2026,
      month: 10,
    });
    expect(usePeriods.getState().periods["UI-20"]).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });
  it("YEAR_CUM은 선택월까지 누계를 보여준다", async () => {
    render(<PeriodBar screenId="UI-07" type="YEAR_CUM" />);
    await userEvent.selectOptions(screen.getByLabelText("누계 종료 월"), "3");
    expect(screen.getByText("1월 ~ 3월 누계")).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
  it("blur 오류와 저장 첫 오류 focus를 제공한다", async () => {
    render(<Components />);
    await userEvent.click(screen.getByLabelText("이름·상호"));
    await userEvent.tab();
    expect(screen.getByLabelText("이름·상호")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "저장: 검증 견본" }),
    );
    expect(screen.getByLabelText("이름·상호")).toHaveFocus();
  });
  it("금액 붙여넣기, MM 경고 저장, Unicode 제한, 사업자번호 및 readonly를 실제 조작한다", async () => {
    render(<Components />);
    fireEvent.change(screen.getByLabelText("이름·상호"), {
      target: { value: "😀".repeat(51) },
    });
    expect(screen.getByLabelText("이름·상호")).toHaveValue("😀".repeat(50));
    expect(screen.getByText("50/50")).toBeVisible();
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "1,500,000 원" },
    });
    expect(screen.getByLabelText("금액")).toHaveValue("1,500,000");
    await userEvent.type(screen.getByLabelText("MM"), "1.20");
    expect(screen.getByText("1.00 초과 (저장 가능)")).toBeVisible();
    await userEvent.type(screen.getByLabelText("사업자번호"), "1234567890");
    expect(screen.getByLabelText("사업자번호")).toHaveValue("123-45-67890");
    expect(screen.getByLabelText("계산 칸")).toHaveAttribute("readonly");
    await userEvent.click(
      screen.getByRole("button", { name: "저장: 검증 견본" }),
    );
    expect(
      await screen.findByText("로컬 입력 검증을 완료했습니다."),
    ).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
  it.each(["-1", "1.5", "1000000000000", ""])("금액 %s는 오류", (value) => {
    expect(amountError(value)).not.toBeNull();
  });
  it.each(["0", "999999999999"])("금액 경계 %s는 허용", (value) =>
    expect(amountError(value)).toBeNull(),
  );
  it.each(["-1", "3.01", "4", ""])("MM %s는 오류", (value) =>
    expect(mmError(value)).not.toBeNull(),
  );
  it("118행 전체 페이지에서 마지막101-118 범위와 20/50/100 건수를 조작한다", async () => {
    render(<Components />);
    expect(screen.getByText("1-50 / 118건")).toBeVisible();
    expect(screen.getByRole("button", { name: "첫 페이지" })).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "마지막 페이지" }),
    );
    expect(screen.getByText("101-118 / 118건")).toBeVisible();
    await userEvent.selectOptions(
      screen.getByLabelText("견본 목록 건수"),
      "20",
    );
    expect(screen.getByText("1-20 / 118건")).toBeVisible();
    await userEvent.selectOptions(
      screen.getByLabelText("견본 목록 건수"),
      "100",
    );
    expect(screen.getByText("1-100 / 118건")).toBeVisible();
  });
  it("작업 창은 바깥 클릭으로 닫히지 않고 확인 창만 위험 조작을 가진다", async () => {
    render(<Components />);
    expect(screen.queryByRole("button", { name: "삭제 견본" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "작업 창" }));
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    await userEvent.click(screen.getByRole("button", { name: "확인 창" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "삭제 견본",
      }),
    ).toBeVisible();
  });
});
