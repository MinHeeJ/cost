import { useCallback } from "react";
import { getParam } from "./api";
import { useReferenceQuery } from "./useReferenceQuery";

/** Select a parameter by the caller's domain key and month, never by a sample ID. */
export function useParam(key: string, month: string) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const response = await getParam(key, month, signal);
      if (!response.data) throw new Error("기준값 응답을 확인할 수 없습니다.");
      return response.data;
    },
    [key, month],
  );
  return useReferenceQuery(JSON.stringify([key, month]), load);
}
