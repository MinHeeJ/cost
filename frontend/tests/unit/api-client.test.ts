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
import * as registered from "../../src/api/apiClient";
import * as menuApi from "../../src/pages/menus/api";
import * as codeApi from "../../src/pages/codegroups/api";
import * as mappingApi from "../../src/pages/excelmappings/api";
import * as paramApi from "../../src/pages/params/api";
import * as historyApi from "../../src/pages/adminops/api";
import * as referenceApi from "../../src/pages/apiops/api";

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

describe("관리·공개 기준 API 등록", () => {
  it("여섯 feature의 실제 client를 재사용하며 별도 transport를 만들지 않는다", () => {
    for (const source of [
      menuApi,
      codeApi,
      mappingApi,
      paramApi,
      historyApi,
      referenceApi,
    ]) {
      for (const [name, value] of Object.entries(source)) {
        if (name in registered) {
          expect(registered[name as keyof typeof registered]).toBe(value);
        }
      }
    }
  });

  it("관리 조회와 공개 조회는 전달된 key·필터·month를 상대경로로 보낸다", async () => {
    request.mockResolvedValue(response([]));
    const group = "직무 / JOB";
    const key = "기준 / VAT";
    await registered.getAdminMenus();
    await registered.getCodeGroups();
    await registered.getGroupCodes(group);
    await registered.getExcelMappings();
    await registered.getAdminParams();
    await registered.getParamHistory(key);
    await registered.getCodeHistory({ group, page: 2, size: 20 });
    await registered.getCodes(group);
    await registered.getParam(key, "2026-11");
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/api/admin/menus",
      "/api/admin/code-groups",
      `/api/admin/code-groups/${encodeURIComponent(group)}/codes`,
      "/api/admin/excel-mappings",
      "/api/admin/params",
      `/api/admin/params/${encodeURIComponent(key)}/history`,
      `/api/admin/code-history?${new URLSearchParams({ page: "2", size: "20", group })}`,
      `/api/codes/${encodeURIComponent(group)}`,
      `/api/params/${encodeURIComponent(key)}?month=2026-11`,
    ]);
    for (const [, options] of request.mock.calls)
      expect(options.headers).not.toHaveProperty("Authorization");
  });

  it("저장 client는 기존 payload와 삼중 query 식별자 및 소수 정밀도를 유지한다", async () => {
    request.mockResolvedValue(response({}));
    await registered.updateAdminMenus([]);
    await registered.createMenuGroup("새 묶음", "grid");
    await registered.createCodeGroup({
      group_code: "NEW_GROUP",
      group_name: "새 그룹",
    });
    await registered.updateGroupCodes("JOB", []);
    const key = {
      excel_label: "운영 & 보조",
      target_group: "JOB",
      target_code: "OPS",
    };
    await registered.createExcelMapping({
      ...key,
      map_role: "MAIN",
      note: null,
    });
    await registered.updateExcelMapping(key, { note: null, use_yn: "N" });
    await registered.updateParam("VAT_RATE", {
      effective_from: "2026-11",
      num_value: "99999999999999.1234",
    });
    expect(
      request.mock.calls.map(([path, options]) => [path, options.method]),
    ).toEqual([
      ["/api/admin/menus", "PUT"],
      ["/api/admin/menus/groups", "POST"],
      ["/api/admin/code-groups", "POST"],
      ["/api/admin/code-groups/JOB/codes", "PUT"],
      ["/api/admin/excel-mappings", "POST"],
      [`/api/admin/excel-mappings?${new URLSearchParams(key)}`, "PATCH"],
      ["/api/admin/params/VAT_RATE", "PUT"],
    ]);
    expect(JSON.parse(request.mock.calls[5][1].body)).toEqual({
      note: null,
      use_yn: "N",
    });
    expect(request.mock.calls[6][1].body).toBe(
      '{"effective_from":"2026-11","num_value":99999999999999.1234}',
    );
    for (const [, options] of request.mock.calls)
      expect(options.headers).not.toHaveProperty("Authorization");
  });
});
