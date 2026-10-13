import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiGet, ApiClientError } from "../../src/app/api-client";
import ErrorBanner from "../../src/components/ErrorBanner";

afterEach(() => vi.unstubAllGlobals());

function ReadForm() {
  const [text, setText] = useState("입력 보존");
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  async function read() {
    setPending(true);
    try {
      await apiGet("/api/health");
      setError(null);
    } catch (failure) {
      setError(failure as Error);
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <input
        aria-label="작성 내용"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button onClick={read} disabled={pending}>
        조회
      </button>
      <ErrorBanner error={error} onRetry={read} retrying={pending} />
    </div>
  );
}

function failedResponse() {
  return {
    ok: false,
    status: 500,
    headers: new Headers({ "X-Request-Id": "server-uuid" }),
    json: async () => ({
      success: false,
      meta: {},
      code: "500",
      message: "처리 중 오류",
      field: null,
      requestId: "server-uuid",
    }),
  };
}

describe("오류 경계와 재시도", () => {
  it("서버 500은 띠·문의 번호를 보이고 입력 유지 후 같은 읽기를 재시도한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(failedResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, meta: {} }),
      });
    vi.stubGlobal("fetch", fetcher);
    render(<ReadForm />);
    await userEvent.type(screen.getByLabelText("작성 내용"), " 추가");
    await userEvent.click(screen.getByRole("button", { name: "조회" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "문의 번호: server-uuid",
    );
    expect(screen.getByLabelText("작성 내용")).toHaveValue("입력 보존 추가");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "/api/health",
      "/api/health",
    ]);
    expect(screen.getByLabelText("작성 내용")).toHaveValue("입력 보존 추가");
  });
  it("연결 실패는 서버 응답 없음이며 문의 번호를 만들지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    render(<ReadForm />);
    await userEvent.click(screen.getByRole("button", { name: "조회" }));
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("서버 응답 없음");
    expect(banner).not.toHaveTextContent("문의 번호:");
    expect(screen.getByLabelText("작성 내용")).toHaveValue("입력 보존");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("재시도 처리 중 버튼의 재클릭을 방지한다", async () => {
    const retry = vi.fn();
    render(
      <ErrorBanner
        error={new ApiClientError("서버 응답 없음", null, null)}
        onRetry={retry}
        retrying
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "처리 중…" }));
    expect(retry).not.toHaveBeenCalled();
  });
  it("절대 API 주소는 요청하지 않는다", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      apiGet("https://example.com/api/health"),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
