import { apiGet, apiRequest } from "../../app/api-client";

export interface ExcelMapping {
  excel_label: string;
  target_group: string;
  target_code: string;
  map_role: "MAIN" | "SUB";
  note: string | null;
  use_yn: "Y" | "N";
  group_name: string;
  code_name: string;
}
export type CreateExcelMappingRequest = Pick<
  ExcelMapping,
  "excel_label" | "target_group" | "target_code" | "map_role" | "note"
>;
export type UpdateExcelMappingRequest = Partial<
  Pick<ExcelMapping, "map_role" | "note" | "use_yn">
>;
export type ExcelMappingKey = Pick<
  ExcelMapping,
  "excel_label" | "target_group" | "target_code"
>;
export interface ExcelMappingGroup {
  group_code: string;
  group_name: string;
}
export interface ExcelMappingCodeOption {
  code: string;
  name: string;
}
export const getExcelMappings = () =>
  apiGet<ExcelMapping[]>("/api/admin/excel-mappings");
export const createExcelMapping = (body: CreateExcelMappingRequest) =>
  apiRequest<ExcelMapping>("/api/admin/excel-mappings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export const updateExcelMapping = (
  key: ExcelMappingKey,
  body: UpdateExcelMappingRequest,
) => {
  const query = new URLSearchParams({
    excel_label: key.excel_label,
    target_group: key.target_group,
    target_code: key.target_code,
  });
  return apiRequest<ExcelMapping>(`/api/admin/excel-mappings?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};
export const getExcelMappingGroups = () =>
  apiGet<ExcelMappingGroup[]>("/api/admin/code-groups");
export const getExcelMappingCodes = (group: string, signal?: AbortSignal) =>
  apiGet<ExcelMappingCodeOption[]>(
    `/api/codes/${encodeURIComponent(group)}`,
    signal,
  );
