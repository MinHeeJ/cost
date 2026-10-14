import type { ReactNode } from "react";

/** 표 정의의 분류 메타데이터. 현재 렌더링과 값에는 영향을 주지 않는다. */
export interface SensitiveColumn {
  key: string;
  label: string;
  sensitive?: boolean;
}

export interface SensitiveCellProps {
  sensitive?: boolean;
  children: ReactNode;
}

/** td 자체는 호출 화면이 소유하고 이 경계는 원래 값과 입력 상태를 보존한다. */
export function SensitiveCell({ children }: SensitiveCellProps) {
  return <>{children}</>;
}

export default SensitiveCell;
