import { useCallback, useEffect, useState } from "react";
import { getExcelMappingCodes, type ExcelMappingCodeOption } from "./api";

/** 활성 코드만 공통 조회 API에서 읽으며 그룹 변경 시 이전 선택지를 즉시 제외한다. */
export function useCodes(group: string) {
  const [state, setState] = useState<{
    group: string;
    codes: ExcelMappingCodeOption[];
    loading: boolean;
    error: Error | null;
  }>({ group: "", codes: [], loading: false, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!group) {
      setState({ group, codes: [], loading: false, error: null });
      return;
    }
    setState({ group, codes: [], loading: true, error: null });
    getExcelMappingCodes(group, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({
            group,
            codes: result.data ?? [],
            loading: false,
            error: null,
          });
        }
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted)
          setState({ group, codes: [], loading: false, error });
      });
    return () => controller.abort();
  }, [group, retry]);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ group: string }>).detail?.group === group)
        reload();
    };
    window.addEventListener("common-code-options-changed", changed);
    return () =>
      window.removeEventListener("common-code-options-changed", changed);
  }, [group, reload]);
  return {
    codes: state.group === group ? state.codes : [],
    loading: Boolean(group) && (state.group !== group || state.loading),
    error: state.group === group ? state.error : null,
    reload,
  };
}
