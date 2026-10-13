export interface ApiResponse<T = undefined> {
  success: true;
  meta: Record<string, unknown>;
  data?: T;
}

export interface ApiError {
  success: false;
  meta: Record<string, unknown>;
  code: string;
  message: string;
  field: string | null;
  requestId: string;
}

/** Server failures keep the supplied inquiry number; network failures never invent one. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly requestId: string | null,
    public readonly field: string | null = null,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Reads same-origin API envelopes. Calling components retain their inputs and own retries. */
export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  if (!path.startsWith("/api/") || path.includes("://")) {
    throw new TypeError("API 경로는 같은 origin의 /api/ 경로여야 합니다.");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { Accept: "application/json", ...options?.headers },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      throw error;
    throw new ApiClientError("서버 응답 없음", null, null);
  }
  let body: ApiResponse<T> | ApiError;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      "서버 응답을 확인할 수 없습니다.",
      response.status,
      response.headers.get("X-Request-Id"),
    );
  }
  if (!response.ok || body.success !== true) {
    const failure = body as ApiError;
    throw new ApiClientError(
      failure.message || "처리 중 오류가 발생했습니다.",
      response.status,
      failure.requestId ?? response.headers.get("X-Request-Id"),
      failure.field ?? null,
      failure.code ?? null,
    );
  }
  return body;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) =>
  apiRequest<T>(path, { signal });
export const getHealth = () => apiGet("/api/health");
