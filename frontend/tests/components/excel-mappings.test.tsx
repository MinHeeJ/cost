import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExcelMappings from "../../src/pages/excelmappings/ExcelMappings";
import type { ExcelMapping } from "../../src/pages/excelmappings/api";

const request = vi.fn();
const original: ExcelMapping = {
  excel_label: "운영 & 보조",
  target_group: "JOB",
  target_code: "OPS",
  group_name: "직무",
  code_name: "운영",
  map_role: "MAIN",
  note: "기존 메모",
  use_yn: "Y",
};
let rows: ExcelMapping[];
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
function failure(status: number, field: string | null, code = String(status)) {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: async () => ({
      success: false,
      meta: {},
      code,
      field,
      message: "입력값을 확인해 주세요.",
      requestId: "mapping-inquiry",
    }),
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  request.mockReset();
  rows = [{ ...original }];
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/api/admin/code-groups")
      return success([{ group_code: "JOB", group_name: "직무" }]);
    if (path === "/api/codes/JOB")
      return success([{ code: "BE", name: "백엔드" }]);
    if (options?.method === "PATCH") {
      const query = new URL(path, "https://test.invalid").searchParams;
      const index = rows.findIndex(
        (row) =>
          row.excel_label === query.get("excel_label") &&
          row.target_group === query.get("target_group") &&
          row.target_code === query.get("target_code"),
      );
      rows[index] = { ...rows[index], ...JSON.parse(String(options.body)) };
      return success(rows[index]);
    }
    if (options?.method === "POST") {
      const row = {
        ...JSON.parse(String(options.body)),
        group_name: "직무",
        code_name: "백엔드",
        use_yn: "Y",
      };
      rows.push(row);
      return success(row);
    }
    return success(rows);
  });
  vi.stubGlobal("fetch", request);
});

async function open() {
  await userEvent.click(screen.getByRole("button", { name: "+ 대응 추가" }));
  await screen.findByRole("option", { name: "직무" });
  return screen.getByRole("dialog", { name: "대응 추가" });
}
async function fill(dialog: HTMLElement) {
  const ui = within(dialog);
  await userEvent.type(ui.getByRole("textbox", { name: "엑셀 표기" }), "개발");
  await userEvent.selectOptions(
    ui.getByRole("combobox", { name: "그룹" }),
    "JOB",
  );
  await ui.findByRole("option", { name: "백엔드" });
  await userEvent.selectOptions(
    ui.getByRole("combobox", { name: "코드" }),
    "BE",
  );
}

describe("UI-27 엑셀 표기 대응 패널", () => {
  it("로딩과 기존 중지 코드 이름을 표시하고 hover 코드를 보존한다", async () => {
    render(<ExcelMappings />);
    expect(screen.getByText("대응을 불러오는 중…")).toBeVisible();
    expect(await screen.findByText("직무 · 운영")).toHaveAttribute(
      "title",
      "OPS",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    expect(request).toHaveBeenCalledWith(
      "/api/admin/excel-mappings",
      expect.anything(),
    );
  });

  it("빈 목록은 성공 안내를 표시한다", async () => {
    rows = [];
    render(<ExcelMappings />);
    expect(
      await screen.findByText("등록된 엑셀 표기 대응이 없습니다."),
    ).toBeVisible();
  });

  it("실패 조회는 문의 번호와 재시도를 제공한다", async () => {
    request.mockRejectedValueOnce(new Error("network"));
    render(<ExcelMappings />);
    expect(await screen.findAllByText("서버 응답 없음")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("직무 · 운영")).toBeVisible();
  });

  it("PATCH는 선택한 삼중키를 query로 보내고 변경 필드만 저장하며 dirty를 해제한다", async () => {
    const dirty = vi.fn();
    const saved = vi.fn();
    render(<ExcelMappings onDirtyChange={dirty} onSaved={saved} />);
    await screen.findByText("직무 · 운영");
    const memo = screen.getByRole("textbox", { name: "운영 & 보조 메모" });
    await userEvent.clear(memo);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "운영 & 보조 사용" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(
      await screen.findByTestId("excel-mapping-success"),
    ).toHaveTextContent("대응을 저장했습니다.");
    const [path, options] = request.mock.calls.find(
      (call) => call[1]?.method === "PATCH",
    )!;
    const query = new URL(path, "https://test.invalid").searchParams;
    expect(Object.fromEntries(query)).toEqual({
      excel_label: original.excel_label,
      target_group: "JOB",
      target_code: "OPS",
    });
    expect(JSON.parse(options.body)).toEqual({ note: null, use_yn: "N" });
    expect(saved).toHaveBeenCalledOnce();
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
  });

  it("취소는 서버 snapshot으로 복원하고 저장 API를 호출하지 않는다", async () => {
    render(<ExcelMappings />);
    await screen.findByText("직무 · 운영");
    const memo = screen.getByRole("textbox", { name: "운영 & 보조 메모" });
    await userEvent.type(memo, "수정");
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(memo).toHaveValue("기존 메모");
    expect(request.mock.calls.some((call) => call[1]?.method === "PATCH")).toBe(
      false,
    );
  });

  it("400 field는 초안을 유지하고 해당 입력에 초점을 준다", async () => {
    const base = request.getMockImplementation()!;
    request.mockImplementation((path, options) =>
      options?.method === "PATCH"
        ? Promise.resolve(failure(400, "note"))
        : base(path, options),
    );
    render(<ExcelMappings />);
    await screen.findByText("직무 · 운영");
    const memo = screen.getByRole("textbox", { name: "운영 & 보조 메모" });
    await userEvent.type(memo, "초안");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await screen.findByText("문의 번호: mapping-inquiry");
    expect(memo).toHaveValue("기존 메모초안");
    expect(memo).toHaveFocus();
  });

  it("추가는 실제 그룹과 활성 코드 API로 선택하고 POST 결과를 목록에 반영한다", async () => {
    render(<ExcelMappings />);
    await screen.findByText("직무 · 운영");
    const dialog = await open();
    await fill(dialog);
    expect(
      within(dialog).queryByRole("option", { name: "운영" }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    expect(
      await screen.findByTestId("excel-mapping-success"),
    ).toHaveTextContent("대응을 추가했습니다.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("직무 · 백엔드")).toBeVisible();
    const call = request.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(JSON.parse(call[1].body)).toEqual({
      excel_label: "개발",
      target_group: "JOB",
      target_code: "BE",
      map_role: "MAIN",
      note: null,
    });
  });

  it("추가 필수값 오류는 창을 유지하고 엑셀 표기에 초점을 준다", async () => {
    render(<ExcelMappings />);
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    expect(
      within(dialog).getByRole("textbox", { name: "엑셀 표기" }),
    ).toHaveFocus();
    expect(
      within(dialog).getAllByText("필수값과 입력 길이를 확인해 주세요."),
    ).toHaveLength(2);
    expect(request.mock.calls.some((call) => call[1]?.method === "POST")).toBe(
      false,
    );
  });

  it("중복 409는 문의 번호와 창 초안을 유지한다", async () => {
    const base = request.getMockImplementation()!;
    request.mockImplementation((path, options) =>
      options?.method === "POST"
        ? Promise.resolve(failure(409, null, "DUPLICATE_CODE"))
        : base(path, options),
    );
    render(<ExcelMappings />);
    const dialog = await open();
    await fill(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    expect(
      await within(dialog).findByText("문의 번호: mapping-inquiry"),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("textbox", { name: "엑셀 표기" }),
    ).toHaveValue("개발");
    expect(within(dialog).getByRole("combobox", { name: "코드" })).toHaveValue(
      "BE",
    );
  });

  it("활성 코드가 없으면 빈 안내와 코드 선택 불가 상태를 제공한다", async () => {
    const base = request.getMockImplementation()!;
    request.mockImplementation((path, options) =>
      path === "/api/codes/JOB"
        ? Promise.resolve(success([]))
        : base(path, options),
    );
    render(<ExcelMappings />);
    const dialog = await open();
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "그룹" }),
      "JOB",
    );
    expect(
      await within(dialog).findByText("활성 코드가 없습니다."),
    ).toBeVisible();
    expect(within(dialog).getByRole("combobox", { name: "코드" })).toHaveValue(
      "",
    );
  });
});
