import { useCallback, useEffect } from "react";
import { getCodes } from "./api";
import { useReferenceQuery } from "./useReferenceQuery";

/** All selection options come from the public active-code API; no fixed option registry. */
export function useCodes(group: string) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const response = await getCodes(group, signal);
      if (!response.data) throw new Error("코드 응답을 확인할 수 없습니다.");
      return response.data;
    },
    [group],
  );
  const query = useReferenceQuery(group, load);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ group: string }>).detail?.group === group)
        query.retry();
    };
    window.addEventListener("common-code-options-changed", changed);
    return () =>
      window.removeEventListener("common-code-options-changed", changed);
  }, [group, query.retry]);
  return { ...query, codes: query.data ?? [] };
}
