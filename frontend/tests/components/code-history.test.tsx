import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CodeHistory from "../../src/pages/adminops/CodeHistory";
import type { CodeHistoryItem } from "../../src/pages/adminops/api";

const request = vi.fn();
const tl: CodeHistoryItem = {
  group_code: "POSITION",
  group_name: "직위",
  code: "TL",
  action: "UPDATE",
  field_name: "attr1",
  before_value: "200000",
  after_value: "250000",
  changed_by: null,
  changed_at: "2026-10-14T10:00:00",
};
const ops: CodeHistoryItem = {
  ...tl,
  group_code: "JOB",
  group_name: "직무",
  code: "OPS",
  action: "DISABLE",
  field_name: "use_yn",
  before_value: "Y",
  after_value: "N",
  changed_at: "2026-10-14T09:00:00",
};
let rows: CodeHistoryItem[];
let total: number;
function success(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      success: true,
      meta: {},
      data: structuredClone(data),
    }),
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
      field,
      message: "조회에 실패했습니다.",
      requestId: "history-inquiry",
    }),
  };
}
const isHistory = (path: string) => path.startsWith("/api/admin/code-history?");
beforeEach(() => {
  vi.restoreAllMocks();
  request.mockReset();
  rows = [tl, ops];
  total = 2;
  request.mockImplementation(async (path: string) => {
    if (path === "/api/admin/code-groups") {
      return success([
        { group_code: "POSITION", group_name: "직위" },
        { group_code: "JOB", group_name: "직무" },
      ]);
    }
    const query = new URL(path, "https://test.invalid").searchParams;
    return success({
      items: rows.filter(
        (row) => !query.has("group") || row.group_code === query.get("group"),
      ),
      total,
      page: Number(query.get("page")),
      size: Number(query.get("size")),
    });
  });
  vi.stubGlobal("fetch", request);
});

describe("UI-27 변경 이력 패널", () => {
  it("비인증 조회는 로딩 이후 실제 전후값·구분·NULL 기본 사용자를 readonly로 표시한다", async () => {
    render(<CodeHistory />);
    expect(screen.getByTestId("code-history-loading")).toBeVisible();
    expect(await screen.findByText("250000")).toBeVisible();
    const first = within(screen.getByTestId("code-history-row-0"));
    expect(first.getByText("200000")).toBeVisible();
    expect(first.getByText("수정")).toHaveAttribute("title", "UPDATE");
    expect(first.getByText("기본 사용자")).toBeVisible();
    expect(screen.getByText("사용 중지")).toHaveAttribute("title", "DISABLE");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "저장" }),
    ).not.toBeInTheDocument();
    const [path, options] = request.mock.calls.find(([path]) =>
      isHistory(path),
    )!;
    expect(path).toBe("/api/admin/code-history?page=1&size=50");
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(screen.getByText("전체 2건 · 최신순")).toBeVisible();
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("그룹 선택은 API 이름으로 보이고 group query를 사용하며 첫 페이지로 돌아간다", async () => {
    total = 120;
    render(<CodeHistory />);
    await screen.findByText("250000");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() =>
      expect(screen.getByTestId("code-history-page")).toHaveTextContent(
        "2페이지",
      ),
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "이력 그룹" }),
      "JOB",
    );
    await screen.findByText("OPS");
    expect(screen.queryByText("TL")).not.toBeInTheDocument();
    expect(screen.getByTestId("code-history-page")).toHaveTextContent(
      "1페이지",
    );
    const [path] = request.mock.calls
      .filter(([path]) => isHistory(path))
      .at(-1)!;
    const query = new URL(path, "https://test.invalid").searchParams;
    expect(Object.fromEntries(query)).toEqual({
      page: "1",
      size: "50",
      group: "JOB",
    });
    expect(query.has("group_code")).toBe(false);
  });

  it("PARAM은 등록 없이 기준값 옵션으로 표시하고 NULL 코드·전값과 문자열 변경자를 보존한다", async () => {
    rows = [
      {
        ...tl,
        group_code: "PARAM",
        group_name: "기준값",
        code: null,
        before_value: null,
        action: "ADD",
        changed_by: "9007199254740993",
      },
    ];
    render(<CodeHistory />);
    await screen.findByText("9007199254740993");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "이력 그룹" }),
      "PARAM",
    );
    await waitFor(() =>
      expect(
        request.mock.calls.some(([path]) => path.includes("group=PARAM")),
      ).toBe(true),
    );
    const row = within(screen.getByTestId("code-history-row-0"));
    expect(row.getByText("기준값")).toBeVisible();
    expect(row.getByText("추가")).toHaveAttribute("title", "ADD");
    expect(row.getAllByText("—")).toHaveLength(2);
  });

  it("페이지 크기 20·50·100을 선택하면 첫 페이지로 돌아가고 마지막 페이지 다음은 비활성이다", async () => {
    total = 60;
    render(<CodeHistory />);
    await screen.findByText("250000");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "다음" })).toBeDisabled(),
    );
    const size = screen.getByRole("combobox", { name: "이력 페이지 크기" });
    await userEvent.selectOptions(size, "20");
    await waitFor(() =>
      expect(
        request.mock.calls.some(([path]) => path.includes("page=1&size=20")),
      ).toBe(true),
    );
    expect(screen.getByTestId("code-history-page")).toHaveTextContent(
      "1페이지",
    );
    await userEvent.selectOptions(size, "100");
    await waitFor(() =>
      expect(
        request.mock.calls.some(([path]) => path.includes("page=1&size=100")),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "다음" })).toBeDisabled(),
    );
  });

  it("조건별 빈 결과는 안내와 재조회만 표시하고 가짜 이력을 만들지 않는다", async () => {
    rows = [];
    total = 0;
    render(<CodeHistory />);
    expect(
      await screen.findByText("해당 그룹의 변경 이력이 없습니다."),
    ).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const before = request.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(request.mock.calls.length).toBe(before + 1));
    expect(screen.getByText("전체 0건 · 최신순")).toBeVisible();
  });

  it("이력 오류는 문의 번호·필터·페이지를 보존하고 같은 조회만 재시도한다", async () => {
    total = 120;
    const base = request.getMockImplementation()!;
    let reject = true;
    request.mockImplementation((path, options) =>
      path.includes("page=2") && reject
        ? Promise.resolve(failure())
        : base(path, options),
    );
    render(<CodeHistory />);
    await screen.findByText("250000");
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("문의 번호: history-inquiry")).toBeVisible();
    expect(screen.getByTestId("code-history-page")).toHaveTextContent(
      "2페이지",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    reject = false;
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("250000");
    const paths = request.mock.calls
      .filter(([path]) => isHistory(path))
      .map(([path]) => path);
    expect(paths.at(-1)).toEqual(paths.at(-2));
    expect(
      request.mock.calls.every(
        ([, options]) => !options?.method || options.method === "GET",
      ),
    ).toBe(true);
  });

  it("400 field는 해당 필터에 초점을 주고 선택값을 유지한다", async () => {
    const base = request.getMockImplementation()!;
    request.mockImplementation((path, options) =>
      path.includes("group=JOB")
        ? Promise.resolve(failure("group"))
        : base(path, options),
    );
    render(<CodeHistory />);
    await screen.findByText("250000");
    const group = screen.getByRole("combobox", { name: "이력 그룹" });
    await userEvent.selectOptions(group, "JOB");
    await screen.findByText("문의 번호: history-inquiry");
    expect(group).toHaveValue("JOB");
    expect(group).toHaveFocus();
    expect(group).toHaveAttribute("aria-invalid", "true");
  });

  it("옵션 조회 실패에도 이력을 유지하며 옵션만 다시 조회한다", async () => {
    const base = request.getMockImplementation()!;
    let reject = true;
    request.mockImplementation((path, options) =>
      path === "/api/admin/code-groups" && reject
        ? Promise.reject(new Error("network"))
        : base(path, options),
    );
    render(<CodeHistory />);
    await screen.findByText("250000");
    expect(screen.getAllByText("서버 응답 없음")).toHaveLength(2);
    const before = request.mock.calls.filter(([path]) =>
      isHistory(path),
    ).length;
    reject = false;
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("option", { name: "직무" });
    expect(request.mock.calls.filter(([path]) => isHistory(path))).toHaveLength(
      before,
    );
  });

  it("늦게 도착한 이전 필터 결과가 현재 결과를 덮어쓰지 않는다", async () => {
    const base = request.getMockImplementation()!;
    let resolveOld!: (value: ReturnType<typeof success>) => void;
    request.mockImplementation((path, options) =>
      path.includes("group=POSITION")
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : base(path, options),
    );
    render(<CodeHistory />);
    await screen.findByText("250000");
    const group = screen.getByRole("combobox", { name: "이력 그룹" });
    await userEvent.selectOptions(group, "POSITION");
    await userEvent.selectOptions(group, "JOB");
    await screen.findByText("OPS");
    await act(async () =>
      resolveOld(success({ items: [tl], total: 1, page: 1, size: 50 })),
    );
    expect(screen.queryByText("TL")).not.toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeVisible();
  });

  it("부모 저장 후 refreshToken은 현재 조건을 유지한 채 이력을 갱신한다", async () => {
    const { rerender } = render(<CodeHistory refreshToken={0} />);
    await screen.findByText("250000");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "이력 그룹" }),
      "JOB",
    );
    await screen.findByText("OPS");
    rows = [{ ...ops, action: "ENABLE", before_value: "N", after_value: "Y" }];
    rerender(<CodeHistory refreshToken={1} />);
    expect(await screen.findByText("다시 사용")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "이력 그룹" })).toHaveValue(
      "JOB",
    );
    expect(screen.getByTestId("code-history-page")).toHaveTextContent(
      "1페이지",
    );
  });
});
