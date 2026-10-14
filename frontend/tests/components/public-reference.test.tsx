import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeSelect } from "../../src/pages/apiops/CodeSelect";
import { ParamValue } from "../../src/pages/apiops/ParamValue";
import { getCodes, getParam } from "../../src/pages/apiops/api";

const option = {
  code: "BE",
  name: "개발",
  attr1: "250000",
  attr2: null,
  attr3: null,
};
const param = {
  param_key: "VAT_RATE",
  effective_from: "2000-01",
  param_name: "부가세율",
  num_value: 10,
  text_value: null,
  unit: "%",
  used_in: "계약",
};
const success = (data: unknown) =>
  new Response(JSON.stringify({ success: true, meta: {}, data }), {
    status: 200,
  });
const failure = (status: number, field: string | null = null) =>
  new Response(
    JSON.stringify({
      success: false,
      meta: {},
      code: String(status),
      message: "조회 실패",
      field,
      requestId: "read-inquiry",
    }),
    { status },
  );

afterEach(() => vi.unstubAllGlobals());

describe("공개 기준 자료 API 연결", () => {
  it("선택 목록은 서버의 이름을 표시하고 코드 tooltip과 실제 선택값을 사용한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(success([option]));
    vi.stubGlobal("fetch", fetcher);
    const change = vi.fn();
    render(
      <CodeSelect
        group="JOB"
        value=""
        onChange={change}
        label="직무"
        testId="job-select"
      />,
    );
    expect(screen.getByText("코드 조회 중…")).toBeVisible();
    await screen.findByRole("option", { name: "개발" });
    expect(screen.getByRole("option", { name: "개발" })).toHaveAttribute(
      "title",
      "BE",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "직무" }),
      "BE",
    );
    expect(change).toHaveBeenCalledWith("BE");
    expect(fetcher.mock.calls[0][0]).toBe("/api/codes/JOB");
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty(
      "Authorization",
    );
  });

  it("이미 저장된 중지 코드는 원본 이름으로 보이지만 새 선택으로 제공하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success([option])));
    render(
      <CodeSelect
        group="JOB"
        value="OPS"
        onChange={vi.fn()}
        label="직무"
        testId="job-select"
        savedOption={{ ...option, code: "OPS", name: "운영" }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox")).not.toBeDisabled(),
    );
    expect(screen.getByRole("option", { name: "운영" })).toBeDisabled();
    expect(screen.getByRole("combobox")).toHaveValue("OPS");
    expect(screen.getByRole("combobox")).toHaveAttribute("title", "OPS");
  });

  it("빈 목록을 알려 주고 로컬 업무 옵션을 만들지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => success([])),
    );
    render(
      <CodeSelect
        group="JOB"
        value=""
        onChange={vi.fn()}
        label="직무"
        testId="job-select"
      />,
    );
    await screen.findByText("사용 가능한 코드가 없습니다.");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("combobox")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "다시 조회" }));
    await screen.findByText("사용 가능한 코드가 없습니다.");
  });

  it("오류 문의 번호와 재시도를 제공하며 저장된 선택 입력을 유지한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(failure(500))
        .mockResolvedValueOnce(success([option])),
    );
    render(
      <CodeSelect
        group="JOB"
        value="BE"
        onChange={vi.fn()}
        label="직무"
        testId="job-select"
        savedOption={option}
      />,
    );
    await screen.findByText("문의 번호: read-inquiry");
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("combobox")).toHaveValue("BE");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox")).not.toBeDisabled(),
    );
    expect(screen.getByRole("combobox")).toHaveValue("BE");
  });

  it("선택월 변경은 같은 컴포넌트에서 실제 API 기준값과 적용월을 다시 읽는다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(success(param))
      .mockResolvedValueOnce(
        success({
          ...param,
          num_value: 11,
          effective_from: "2026-11",
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const view = render(
      <ParamValue paramKey="VAT_RATE" month="2026-10" testId="vat-value" />,
    );
    await screen.findByText("10 %");
    expect(screen.getByText("2000-01")).toBeVisible();
    expect(screen.getByText("부가세율")).toHaveAttribute("title", "VAT_RATE");
    view.rerender(
      <ParamValue paramKey="VAT_RATE" month="2026-11" testId="vat-value" />,
    );
    await screen.findByText("11 %");
    expect(screen.queryByText("10 %")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/params/VAT_RATE?month=2026-10",
      "/api/params/VAT_RATE?month=2026-11",
    ]);
  });

  it("숫자 0을 지우지 않고 문자 값과 NULL 단위도 원본대로 표시한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(success({ ...param, num_value: 0 }))
        .mockResolvedValueOnce(
          success({
            ...param,
            num_value: null,
            text_value: "문자 기준",
            unit: null,
          }),
        ),
    );
    const view = render(
      <ParamValue paramKey="VAT_RATE" month="2026-10" testId="param-value" />,
    );
    await screen.findByText("0 %");
    view.rerender(
      <ParamValue paramKey="TEXT_KEY" month="2026-10" testId="param-value" />,
    );
    await screen.findByText("문자 기준");
  });

  it("적용행 없음은 안내와 서버 오류를 모두 표시한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure(404)));
    render(
      <ParamValue paramKey="MISSING" month="2026-10" testId="param-value" />,
    );
    await screen.findByText("해당 월에 적용되는 기준값이 없습니다.");
    expect(screen.getByRole("alert")).toHaveTextContent("read-inquiry");
  });

  it("month 필드 오류와 연결 실패는 조회 화면에서 입력을 지우지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(failure(400, "month"))
        .mockRejectedValueOnce(new TypeError("network")),
    );
    render(
      <ParamValue paramKey="VAT_RATE" month="bad-month" testId="param-value" />,
    );
    await screen.findByText("적용월을 YYYY-MM 형식으로 확인해 주세요.");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("서버 응답 없음"),
    );
  });

  it("공개 조회 client는 동적 식별자를 인코딩하고 상대경로만 사용한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce(success(param));
    vi.stubGlobal("fetch", fetcher);
    await getCodes("SELECTED_GROUP");
    await getParam("선택/기준", "2026-10");
    expect(fetcher.mock.calls[0][0]).toBe("/api/codes/SELECTED_GROUP");
    expect(fetcher.mock.calls[1][0]).toBe(
      `/api/params/${encodeURIComponent("선택/기준")}?month=2026-10`,
    );
  });
});
