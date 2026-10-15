import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ParamsPanel from "../../src/pages/params/ParamsPanel";
import Workspace from "../../src/pages/shared/Workspace";
import { useScreenTabs } from "../../src/pages/shared/tabs";
import { usePreferences } from "../../src/stores/preferences";
import menus from "../fixtures/shared-menus.json";
import type { ParamItem } from "../../src/pages/params/api";

const initial: ParamItem = {
  param_key: "VAT_RATE",
  effective_from: "2000-01",
  param_name: "부가세율",
  num_value: 10,
  text_value: null,
  unit: "%",
  used_in: "계약",
};
const request = vi.fn();
let history: ParamItem[];

function response(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ success: true, meta: {}, data }),
  };
}
function failure(field: string | null = null) {
  return {
    ok: false,
    status: field ? 400 : 500,
    headers: new Headers(),
    json: async () => ({
      success: false,
      meta: {},
      code: field ? "400" : "500",
      message: "입력값을 확인해 주세요.",
      field,
      requestId: "params-request",
    }),
  };
}

beforeEach(() => {
  localStorage.clear();
  usePreferences.getState().reload();
  useScreenTabs.getState().reset();
  vi.restoreAllMocks();
  request.mockReset();
  history = [initial];
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/api/menus") return response(menus);
    if (path.startsWith("/api/month-close?")) {
      return response([{ close_month: "2026-09", status: "CLOSED" }]);
    }
    if (options?.method === "PUT") {
      const input = JSON.parse(String(options.body));
      const next = { ...initial, ...input };
      history = [
        next,
        ...history.filter(
          (item) => item.effective_from !== input.effective_from,
        ),
      ];
      return response(next);
    }
    if (path.endsWith("/history")) return response(history);
    return response([initial]);
  });
  vi.stubGlobal("fetch", request);
});

async function openEdit() {
  await screen.findByText("부가세율");
  await userEvent.click(screen.getByRole("button", { name: "값 변경" }));
  const dialog = screen.getByRole("dialog", { name: "값 변경" });
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled(),
  );
  return dialog;
}

const puts = () =>
  request.mock.calls.filter((call) => call[1]?.method === "PUT");

describe("기준값 화면", () => {
  it("기존 공개 메뉴에서 공통코드 기준값 화면으로 이동한다", async () => {
    render(
      <MemoryRouter initialEntries={["/UI-16"]}>
        <Workspace />
      </MemoryRouter>,
    );
    const nav = await screen.findByRole("navigation", { name: "업무 메뉴" });
    await userEvent.click(within(nav).getByRole("button", { name: "시스템" }));
    await userEvent.click(
      within(nav).getByRole("button", { name: "공통코드" }),
    );
    expect(await screen.findByTestId("params-panel")).toBeVisible();
    expect(await screen.findByText("부가세율")).toBeVisible();
    expect(screen.queryByRole("region", { name: "화면 기간" })).toBeNull();
  });

  it("선택된 key와 값·적용월만 저장하고 미래값은 이력에서 확인한다", async () => {
    const dirty = vi.fn();
    render(<ParamsPanel onDirtyChange={dirty} />);
    const dialog = await openEdit();
    await userEvent.clear(within(dialog).getByLabelText("새 값"));
    await userEvent.type(within(dialog).getByLabelText("새 값"), "11");
    fireEvent.change(within(dialog).getByLabelText("적용 시작월"), {
      target: { value: "2026-11" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(await screen.findByText("기준값을 저장했습니다.")).toBeVisible();
    expect(puts()).toHaveLength(1);
    expect(puts()[0][0]).toBe("/api/admin/params/VAT_RATE");
    expect(JSON.parse(puts()[0][1].body)).toEqual({
      effective_from: "2026-11",
      num_value: 11,
    });
    expect(dirty).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("param-row-vat-rate")).toHaveTextContent("10 %");
    await userEvent.click(screen.getByRole("button", { name: "이력 보기" }));
    expect(
      await screen.findByTestId("param-history-row-2026-11"),
    ).toHaveTextContent("11");
    expect(screen.getByTestId("param-history-row-2000-01")).toHaveTextContent(
      "10",
    );
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("마감 경계 조회 중에는 저장이 비활성이고 닫힌 월 우회를 거부한다", async () => {
    let resolveBoundary!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveBoundary = resolve;
    });
    request.mockImplementation(async (path: string) =>
      path.startsWith("/api/month-close?") ? pending : response([initial]),
    );
    render(<ParamsPanel />);
    await screen.findByText("부가세율");
    await userEvent.click(screen.getByRole("button", { name: "값 변경" }));
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    resolveBoundary(response([{ close_month: "2026-09", status: "CLOSED" }]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "저장" })).toBeEnabled(),
    );
    expect(screen.getByLabelText("적용 시작월")).toHaveAttribute(
      "min",
      "2026-10",
    );
    fireEvent.change(screen.getByLabelText("적용 시작월"), {
      target: { value: "2026-09" },
    });
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(
      screen.getByText("마지막 마감월의 다음 달부터 저장할 수 있습니다."),
    ).toBeVisible();
    expect(puts()).toHaveLength(0);
  });

  it("취소는 초안을 폐기하며 저장 API를 부르지 않는다", async () => {
    const dirty = vi.fn();
    render(<ParamsPanel onDirtyChange={dirty} />);
    const dialog = await openEdit();
    await userEvent.type(within(dialog).getByLabelText("새 값"), "1");
    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(puts()).toHaveLength(0);
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it("400 필드 오류와 문의번호를 표시하며 입력을 보존한다", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string, options?: RequestInit) =>
      options?.method === "PUT"
        ? failure("effective_from")
        : original(path, options),
    );
    render(<ParamsPanel />);
    const dialog = await openEdit();
    fireEvent.change(within(dialog).getByLabelText("적용 시작월"), {
      target: { value: "2026-11" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    expect(
      await within(dialog).findByText("문의 번호: params-request"),
    ).toBeVisible();
    expect(within(dialog).getByLabelText("적용 시작월")).toHaveValue("2026-11");
    expect(within(dialog).getByLabelText("적용 시작월")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(within(dialog).getByLabelText("적용 시작월")).toHaveFocus();
  });

  it("저장 성공 후 목록 재조회 실패는 저장을 다시 보내지 않는다", async () => {
    const original = request.getMockImplementation()!;
    let saved = false;
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === "PUT") saved = true;
      else if (path === "/api/admin/params" && saved) return failure();
      return original(path, options);
    });
    render(<ParamsPanel />);
    const dialog = await openEdit();
    fireEvent.change(within(dialog).getByLabelText("적용 시작월"), {
      target: { value: "2026-11" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await screen.findByText("문의 번호: params-request");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(puts()).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("빈 목록은 신규 기준값 등록 대신 안내를 표시한다", async () => {
    request.mockResolvedValue(response([]));
    render(<ParamsPanel />);
    expect(
      await screen.findByText("현재 적용 가능한 기준값이 없습니다."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "값 변경" })).toBeNull();
  });

  it("마감 읽기 실패는 재시도 전까지 저장을 막고 초안을 보존한다", async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string, options?: RequestInit) =>
      path.startsWith("/api/month-close?")
        ? failure()
        : original(path, options),
    );
    render(<ParamsPanel />);
    await screen.findByText("부가세율");
    await userEvent.click(screen.getByRole("button", { name: "값 변경" }));
    await screen.findByText("문의 번호: params-request");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    expect(screen.getByLabelText("새 값")).toHaveValue("10");
    request.mockImplementation(original);
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "저장" })).toBeEnabled(),
    );
  });

  it("문자 기준값은 숫자로 바꾸지 않고 같은 문자열 필드로 전송한다", async () => {
    const text = {
      ...initial,
      param_key: "TEXT",
      num_value: null,
      text_value: "이전",
    };
    request.mockImplementation(async (path: string) =>
      path.startsWith("/api/month-close?") ? response([]) : response([text]),
    );
    render(<ParamsPanel />);
    const dialog = await openEdit();
    await userEvent.clear(within(dialog).getByLabelText("새 값"));
    await userEvent.type(within(dialog).getByLabelText("새 값"), "새 값");
    fireEvent.change(within(dialog).getByLabelText("적용 시작월"), {
      target: { value: "2026-11" },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await screen.findByText("기준값을 저장했습니다.");
    expect(JSON.parse(puts()[0][1].body)).toEqual({
      effective_from: "2026-11",
      text_value: "새 값",
    });
  });
});
