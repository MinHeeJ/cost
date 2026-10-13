import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  getHealth,
  getMenus,
  getMonthClose,
} from "../../src/api/apiClient";
import {
  getMenus as sharedGetMenus,
  getMonthClose as sharedGetMonthClose,
} from "../../src/pages/shared/api";
import { getHealth as foundationGetHealth } from "../../src/app/api-client";
import menus from "../fixtures/shared-menus.json";

const request = vi.fn();
function response(data?: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      success: true,
      meta: {},
      ...(data === undefined ? {} : { data }),
    }),
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});

describe("공유 API client 등록", () => {
  it("기존 함수 자체를 재사용하여 이중 transport와 역방향 의존을 만들지 않는다", () => {
    expect(getMenus).toBe(sharedGetMenus);
    expect(getMonthClose).toBe(sharedGetMonthClose);
    expect(getHealth).toBe(foundationGetHealth);
  });

  it("getMenus는 공개 relative GET과 단일 배열 envelope 및 문자열 ID를 유지한다", async () => {
    request.mockResolvedValue(response(menus));
    const controller = new AbortController();
    const result = await getMenus(controller.signal);
    expect(request).toHaveBeenCalledWith("/api/menus", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    expect(result).toEqual({ success: true, meta: {}, data: menus });
    expect(typeof result.data![0].menu_id).toBe("string");
  });

  it("getMonthClose는 전달된 기간을 query로 보내며 CLOSED를 그대로 반환한다", async () => {
    const data = [
      { close_month: "2026-09", status: "CLOSED" },
      { close_month: "2026-10", status: "OPEN" },
    ];
    request.mockResolvedValue(response(data));
    const result = await getMonthClose("2026-09", "2026-10");
    expect(request).toHaveBeenCalledWith(
      "/api/month-close?from=2026-09&to=2026-10",
      expect.anything(),
    );
    expect(result.data).toEqual(data);
  });

  it("getHealth는 data나 임의 UP 상태를 추가하지 않는다", async () => {
    request.mockResolvedValue(response());
    expect(await getHealth()).toEqual({ success: true, meta: {} });
    expect(request).toHaveBeenCalledWith("/api/health", expect.anything());
  });

  it("월 입력 오류는 서버 field/code/문의번호를 보존한다", async () => {
    request.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "X-Request-Id": "server-request" }),
      json: async () => ({
        success: false,
        meta: {},
        code: "400",
        message: "종료 월을 확인해 주세요.",
        field: "to",
        requestId: "server-request",
      }),
    });
    await expect(getMonthClose("2026-10", "2026-09")).rejects.toMatchObject({
      status: 400,
      code: "400",
      field: "to",
      requestId: "server-request",
    });
  });

  it("연결 실패는 서버 응답 없음으로 표시하며 문의번호를 만들지 않는다", async () => {
    request.mockRejectedValue(new TypeError("offline"));
    const result = getMenus();
    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    await expect(result).rejects.toMatchObject({
      message: "서버 응답 없음",
      status: null,
      requestId: null,
    });
  });

  it("취소된 요청은 연결 오류로 바꾸지 않는다", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    request.mockRejectedValue(abort);
    await expect(getMenus(new AbortController().signal)).rejects.toBe(abort);
  });
});
