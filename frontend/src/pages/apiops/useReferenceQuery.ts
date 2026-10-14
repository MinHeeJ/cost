import { useCallback, useEffect, useState } from "react";

interface QueryState<T> {
  identity: string;
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Abort stale requests while hidden workspace tabs retain their selected inputs. */
export function useReferenceQuery<T>(
  identity: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QueryState<T>>({
    identity,
    data: null,
    error: null,
    loading: true,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ identity, data: null, error: null, loading: true });
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setState({ identity, data, error: null, loading: false });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            identity,
            data: null,
            error:
              error instanceof Error
                ? error
                : new Error("조회 중 오류가 발생했습니다."),
            loading: false,
          });
        }
      },
    );
    return () => controller.abort();
  }, [identity, load, attempt]);
  return {
    ...(state.identity === identity
      ? state
      : { data: null, error: null, loading: true }),
    retry,
  };
}
