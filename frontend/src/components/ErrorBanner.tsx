import { ApiClientError } from "../app/api-client";
import styles from "./ErrorBanner.module.css";

export interface ErrorBannerProps {
  error: Error | ApiClientError | null;
  onRetry: () => void;
  retrying?: boolean;
}

export function ErrorBanner({
  error,
  onRetry,
  retrying = false,
}: ErrorBannerProps) {
  if (!error) return null;
  const requestId = error instanceof ApiClientError ? error.requestId : null;
  return (
    <div className={styles.banner} role="alert">
      <div>
        <p>{error.message}</p>
        <p>{requestId ? `문의 번호: ${requestId}` : "서버 응답 없음"}</p>
      </div>
      <button type="button" onClick={onRetry} disabled={retrying}>
        {retrying ? "처리 중…" : "다시 시도"}
      </button>
    </div>
  );
}

export default ErrorBanner;
