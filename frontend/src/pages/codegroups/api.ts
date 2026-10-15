import { apiGet, apiRequest } from "../../app/api-client";

export interface CodeGroup {
  group_code: string;
  group_name: string;
  group_kind: "SYSTEM" | "BIZ";
  attr1_label: string | null;
  attr2_label: string | null;
  attr3_label: string | null;
  sort_order: number;
  use_yn: "Y" | "N";
  code_count: number;
}
export interface AdminCode {
  group_code: string;
  code: string;
  code_name: string;
  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
  sort_order: number;
  use_yn: "Y" | "N";
  effective_from: string | null;
}
export type CodeWriteItem = Omit<AdminCode, "group_code">;
export interface CreateCodeGroupRequest {
  group_code: string;
  group_name: string;
  attr1_label?: string | null;
  attr2_label?: string | null;
  attr3_label?: string | null;
}
export const getCodeGroups = () =>
  apiGet<CodeGroup[]>("/api/admin/code-groups");
export const getGroupCodes = (group: string) =>
  apiGet<AdminCode[]>(
    `/api/admin/code-groups/${encodeURIComponent(group)}/codes`,
  );
export const createCodeGroup = (body: CreateCodeGroupRequest) =>
  apiRequest<CodeGroup>("/api/admin/code-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export const updateGroupCodes = (group: string, body: CodeWriteItem[]) =>
  apiRequest<AdminCode[]>(
    `/api/admin/code-groups/${encodeURIComponent(group)}/codes`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

/** Other feature clients can invalidate their active-code cache after a successful save. */
export const CODE_OPTIONS_CHANGED = "common-code-options-changed";
