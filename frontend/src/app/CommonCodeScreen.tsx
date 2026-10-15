import { useCallback, useEffect, useState } from "react";
import CommonCode from "../pages/codegroups/CommonCode";
import ExcelMappings from "../pages/excelmappings/ExcelMappings";
import ParamsPanel from "../pages/params/ParamsPanel";
import CodeHistory from "../pages/adminops/CodeHistory";
import { useScreenTabs } from "../pages/shared/tabs";

/** Compose independent UI-27 panels without feature-to-feature imports or losing hidden drafts. */
export default function CommonCodeScreen() {
  const [dirty, setDirty] = useState({
    codes: false,
    mappings: false,
    params: false,
  });
  const [historyVersion, setHistoryVersion] = useState(0);
  const codesDirty = useCallback((value: boolean) => {
    setDirty((state) =>
      state.codes === value ? state : { ...state, codes: value },
    );
  }, []);
  const mappingsDirty = useCallback((value: boolean) => {
    setDirty((state) =>
      state.mappings === value ? state : { ...state, mappings: value },
    );
  }, []);
  const paramsDirty = useCallback((value: boolean) => {
    setDirty((state) =>
      state.params === value ? state : { ...state, params: value },
    );
  }, []);
  const saved = useCallback(() => setHistoryVersion((value) => value + 1), []);
  useEffect(() => {
    useScreenTabs
      .getState()
      .setDirty("/UI-27", Object.values(dirty).some(Boolean));
  }, [dirty]);

  return (
    <CommonCode
      onDirtyChange={codesDirty}
      onSaved={saved}
      panels={[
        {
          id: "mappings",
          title: "엑셀 표기 대응",
          content: (
            <ExcelMappings onDirtyChange={mappingsDirty} onSaved={saved} />
          ),
        },
        {
          id: "params",
          title: "기준값",
          content: <ParamsPanel onDirtyChange={paramsDirty} onSaved={saved} />,
        },
        {
          id: "history",
          title: "변경 이력",
          content: <CodeHistory refreshToken={historyVersion} />,
        },
      ]}
    />
  );
}
