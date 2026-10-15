import Can from "../../components/Can";
import ErrorBanner from "../../components/ErrorBanner";
import type { CodeOption } from "./api";
import { useCodes } from "./useCodes";

interface CodeSelectProps {
  group: string;
  value: string;
  onChange: (code: string) => void;
  label: string;
  testId: string;
  disabled?: boolean;
  savedOption?: CodeOption;
}

/** Saved inactive values retain their source name without becoming selectable for new values. */
export function CodeSelect({
  group,
  value,
  onChange,
  label,
  testId,
  disabled,
  savedOption,
}: CodeSelectProps) {
  const { codes, loading, error, retry } = useCodes(group);
  const retained =
    savedOption?.code === value && !codes.some((item) => item.code === value)
      ? savedOption
      : null;
  const selected = codes.find((item) => item.code === value) ?? retained;
  return (
    <Can perm="UI-27.read">
      <div data-testid={`${testId}-container`}>
        <ErrorBanner error={error} onRetry={retry} retrying={loading} />
        {loading && <p role="status">코드 조회 중…</p>}
        {!loading && !error && codes.length === 0 && (
          <div>
            <p>사용 가능한 코드가 없습니다.</p>
            <button
              type="button"
              data-testid={`${testId}-retry`}
              onClick={retry}
            >
              다시 조회
            </button>
          </div>
        )}
        <label>
          {label}
          <select
            aria-label={label}
            data-testid={testId}
            disabled={disabled || loading || !!error || codes.length === 0}
            value={value}
            title={selected?.code ?? value}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">선택하세요</option>
            {retained && (
              <option value={retained.code} title={retained.code} disabled>
                {retained.name}
              </option>
            )}
            {codes.map((item) => (
              <option key={item.code} value={item.code} title={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Can>
  );
}
