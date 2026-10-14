import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommonCode from "../../src/pages/codegroups/CommonCode";
import { useScreenTabs } from "../../src/pages/shared/tabs";
import type { AdminCode, CodeGroup } from "../../src/pages/codegroups/api";

// Keep focused runner failures readable rather than dumping the whole rendered table.
configure({
  getElementError: (message) =>
    new Error(message ?? "요소를 찾을 수 없습니다."),
});

const groups: CodeGroup[] = [
  {
    group_code: "POSITION",
    group_name: "직위",
    group_kind: "BIZ",
    attr1_label: "수당",
    attr2_label: null,
    attr3_label: null,
    sort_order: 1,
    use_yn: "Y",
    code_count: 1,
  },
  {
    group_code: "CONTRACT_TYPE",
    group_name: "계약유형",
    group_kind: "SYSTEM",
    attr1_label: "추가 값",
    attr2_label: null,
    attr3_label: null,
    sort_order: 2,
    use_yn: "Y",
    code_count: 1,
  },
];
const code = (group: string): AdminCode => ({
  group_code: group,
  code: group === "POSITION" ? "TL" : "TK",
  code_name: "이름",
  attr1: "200000",
  attr2: null,
  attr3: null,
  sort_order: 1,
  use_yn: "Y",
  effective_from: "2000-01-01",
});
const request = vi.fn();
let stored: Record<string, AdminCode[]>;
function success(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ success: true, meta: {}, data }),
  };
}
beforeEach(() => {
  request.mockReset();
  useScreenTabs.getState().reset();
  useScreenTabs.getState().activate("/UI-27", "공통코드");
  stored = {
    POSITION: [code("POSITION")],
    CONTRACT_TYPE: [code("CONTRACT_TYPE")],
  };
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === "/api/admin/code-groups") {
      if (options?.method === "POST")
        return success({ ...groups[0], ...JSON.parse(String(options.body)) });
      return success(groups);
    }
    const group = path.split("/")[4];
    if (options?.method === "PUT") {
      stored[group] = JSON.parse(String(options.body)).map(
        (item: AdminCode) => ({ ...item, group_code: group }),
      );
    }
    return success(stored[group]);
  });
  vi.stubGlobal("fetch", request);
});

describe("공통코드 코드 영역", () => {
  it("전체 그룹·BIZ 건수·라벨 열·기존 식별값 잠금 및 비인증 저장/재조회를 제공한다", async () => {
    render(<CommonCode />);
    expect(
      await screen.findByRole("button", { name: "직위 1개" }),
    ).toBeVisible();
    const amount = await screen.findByLabelText("수당 1");
    expect(screen.getByLabelText("코드 1")).toHaveAttribute("readonly");
    expect(screen.queryByRole("columnheader", { name: "추가 값2" })).toBeNull();
    await userEvent.clear(amount);
    await userEvent.type(amount, "250000");
    expect(
      useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-27")
        ?.dirty,
    ).toBe(true);
    await userEvent.click(screen.getByTestId("code-save-button"));
    expect(await screen.findByTestId("code-save-success")).toHaveTextContent(
      "코드를 저장했습니다",
    );
    await waitFor(() => expect(stored.POSITION[0].attr1).toBe("250000"));
    const put = request.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(put?.[0]).toBe("/api/admin/code-groups/POSITION/codes");
    expect(JSON.parse(String(put?.[1].body))[0]).not.toHaveProperty(
      "group_code",
    );
    expect(put?.[1].headers).not.toHaveProperty("Authorization");
    await waitFor(() =>
      expect(
        useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-27")
          ?.dirty,
      ).toBe(false),
    );
  });

  it("SYSTEM은 이름/순서만 편집하며 추가와 사용 중지를 허용하지 않는다", async () => {
    render(<CommonCode />);
    await screen.findByLabelText("수당 1");
    await userEvent.click(
      screen.getByRole("button", { name: "계약유형 잠금" }),
    );
    expect(
      await screen.findByText(/계산 규칙에 쓰는 시스템 코드/),
    ).toBeVisible();
    const attr = await screen.findByLabelText("추가 값 1");
    expect(attr).toHaveAttribute("readonly");
    expect(screen.getByLabelText("적용 시작일 1")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("사용 1")).toBeDisabled();
    expect(screen.queryByTestId("code-add-button")).toBeNull();
    await userEvent.clear(screen.getByLabelText("이름 1"));
    await userEvent.type(screen.getByLabelText("이름 1"), "수정 이름");
    await userEvent.click(screen.getByTestId("code-save-button"));
    await waitFor(() =>
      expect(stored.CONTRACT_TYPE[0].code_name).toBe("수정 이름"),
    );
  });

  it("새 BIZ 행은 빈 입력·Y로 시작하고 검증 실패와 취소에서 API를 호출하지 않는다", async () => {
    render(<CommonCode />);
    await screen.findByLabelText("수당 1");
    await userEvent.click(screen.getByTestId("code-add-button"));
    expect(screen.getByLabelText("코드 2")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("사용 2")).toBeChecked();
    expect(screen.getByLabelText("사용 2")).toBeDisabled();
    await userEvent.click(screen.getByTestId("code-save-button"));
    expect(screen.getByLabelText("코드 2")).toHaveFocus();
    expect(
      request.mock.calls.some(([, options]) => options?.method === "PUT"),
    ).toBe(false);
    await userEvent.click(screen.getByTestId("code-cancel-button"));
    expect(screen.queryByLabelText("코드 2")).toBeNull();
  });

  it("다른 그룹과 공급된 탭 사이에서 코드 초안을 보존한다", async () => {
    render(
      <CommonCode
        panels={[
          { id: "history", title: "변경 이력", content: <p>독립 이력 영역</p> },
        ]}
      />,
    );
    const amount = await screen.findByLabelText("수당 1");
    fireEvent.change(amount, { target: { value: "250000" } });
    await userEvent.click(
      screen.getByRole("button", { name: "계약유형 잠금" }),
    );
    await screen.findByLabelText("추가 값 1");
    await userEvent.click(screen.getByRole("button", { name: /직위 1개/ }));
    expect(screen.getByLabelText("수당 1")).toHaveValue("250000");
    await userEvent.click(screen.getByRole("tab", { name: "변경 이력" }));
    expect(screen.getByText("독립 이력 영역")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "코드" }));
    expect(screen.getByLabelText("수당 1")).toHaveValue("250000");
  });

  it("저장 400 field/문의번호를 표시하고 초안과 dirty를 유지한다", async () => {
    render(<CommonCode />);
    const amount = await screen.findByLabelText("수당 1");
    fireEvent.change(amount, { target: { value: "오류 초안" } });
    const previous = request.getMockImplementation()!;
    request.mockImplementation(async (path, options) =>
      options?.method === "PUT"
        ? {
            ok: false,
            status: 400,
            headers: new Headers(),
            json: async () => ({
              success: false,
              code: "400",
              message: "입력값을 확인해 주세요.",
              field: "attr1",
              requestId: "request-123",
              meta: {},
            }),
          }
        : previous(path, options),
    );
    await userEvent.click(screen.getByTestId("code-save-button"));
    expect(await screen.findByText("문의 번호: request-123")).toBeVisible();
    expect(amount).toHaveValue("오류 초안");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveFocus();
    expect(
      useScreenTabs.getState().tabs.find((tab) => tab.route === "/UI-27")
        ?.dirty,
    ).toBe(true);
  });

  it("서버 실패에서 입력을 보존하고 재시도한다", async () => {
    request.mockRejectedValueOnce(new Error("network"));
    render(<CommonCode />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "서버 응답 없음",
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByLabelText("수당 1")).toHaveValue("200000");
  });

  it("그룹과 상세 빈 결과는 가짜 행 대신 빈 안내와 허용된 추가만 표시한다", async () => {
    stored.POSITION = [];
    render(<CommonCode />);
    expect(await screen.findByText("선택 그룹 코드가 없습니다.")).toBeVisible();
    expect(screen.getByTestId("code-add-button")).toBeEnabled();
  });

  it("그룹 전체가 비면 빈 그룹 안내를 표시한다", async () => {
    request.mockResolvedValue(success([]));
    render(<CommonCode />);
    expect(await screen.findByText("코드 그룹이 없습니다.")).toBeVisible();
    expect(screen.queryByTestId("code-save-button")).toBeNull();
  });

  it("그룹 추가 창은 BIZ 고정·초안 검증·성공 목록 재조회를 제공한다", async () => {
    render(<CommonCode />);
    await screen.findByLabelText("수당 1");
    await userEvent.click(screen.getByTestId("code-group-add-button"));
    const dialog = screen.getByRole("dialog", { name: "그룹 추가" });
    expect(within(dialog).getByText("그룹 종류: BIZ")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    expect(within(dialog).getByLabelText("그룹 코드")).toHaveFocus();
    await userEvent.type(
      within(dialog).getByLabelText("그룹 코드"),
      "NEW_GROUP",
    );
    await userEvent.type(
      within(dialog).getByLabelText("그룹 이름"),
      "업무 그룹",
    );
    await userEvent.type(
      within(dialog).getByLabelText("추가 값1 제목"),
      "추가 값",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = request.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(JSON.parse(String(post?.[1].body))).toEqual({
      group_code: "NEW_GROUP",
      group_name: "업무 그룹",
      attr1_label: "추가 값",
    });
    expect(post?.[1].body).not.toContain("group_kind");
  });

  it("그룹 창 취소는 기존 코드 초안을 유지하고 쓰지 않는다", async () => {
    render(<CommonCode />);
    const amount = await screen.findByLabelText("수당 1");
    fireEvent.change(amount, { target: { value: "250000" } });
    await userEvent.click(screen.getByTestId("code-group-add-button"));
    await userEvent.click(screen.getByTestId("code-group-create-cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(amount).toHaveValue("250000");
    expect(
      request.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });
});
