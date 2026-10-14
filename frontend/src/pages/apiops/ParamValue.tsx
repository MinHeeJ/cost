import Can from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import { ApiClientError } from "../../app/api-client";
import { useParam } from "./useParam";

/** Read-only value for the selected domain month, with source metadata and retryable errors. */
export function ParamValue({
  paramKey,
  month,
  testId,
}: {
  paramKey: string;
  month: string;
  testId: string;
}) {
  const { data, loading, error, retry } = useParam(paramKey, month);
  return (
    <Can perm="UI-27.read">
      <section data-testid={testId} aria-label="적용 기준값">
        {loading && <p role="status">기준값 조회 중…</p>}
        <ErrorBanner error={error} onRetry={retry} retrying={loading} />
        {error instanceof ApiClientError && error.status === 404 && (
          <p>해당 월에 적용되는 기준값이 없습니다.</p>
        )}
        {error instanceof ApiClientError && error.field === "month" && (
          <p>적용월을 YYYY-MM 형식으로 확인해 주세요.</p>
        )}
        {data && (
          <dl>
            <dt title={data.param_key}>{data.param_name}</dt>
            <dd>
              {data.num_value ?? data.text_value}
              {data.unit ? ` ${data.unit}` : ""}
            </dd>
            <dt>적용 시작월</dt>
            <dd>{data.effective_from}</dd>
            <dt>사용처</dt>
            <dd>{data.used_in ?? "—"}</dd>
          </dl>
        )}
      </section>
    </Can>
  );
}
