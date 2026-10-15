import type { ReactNode } from "react";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "upload"
  | "download"
  | "confirm";
export type PermissionKey = `${string}.${PermissionAction}`;

/** 권한 키를 명시하는 확장 지점. 현재는 인증 없이 모든 기능을 허용한다. */
export function can(_perm: PermissionKey): boolean {
  return true;
}

export interface CanProps {
  perm: PermissionKey;
  children: ReactNode;
}

export function Can({ perm, children }: CanProps) {
  return can(perm) ? <>{children}</> : null;
}

export default Can;
