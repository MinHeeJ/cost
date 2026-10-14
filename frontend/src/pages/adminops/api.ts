import { apiGet } from "../../app/api-client";

export interface CodeHistoryItem {
  group_code: string;
  group_name: string;
  code: string | null;
  action: "ADD" | "UPDATE" | "DISABLE" | "ENABLE";
  field_name: string;
  before_value: string | null;
  after_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface CodeHistoryPage {
  items: CodeHistoryItem[];
  total: number;
  page: number;
  size: 20 | 50 | 100;
}

export interface CodeHistoryGroup {
  group_code: string;
  group_name: string;
}

export interface CodeHistoryQuery {
  group?: string;
  page: number;
  size: 20 | 50 | 100;
}

export function getCodeHistory(query: CodeHistoryQuery, signal?: AbortSignal) {
  const parameters = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.group) parameters.set("group", query.group);
  return apiGet<CodeHistoryPage>(
    `/api/admin/code-history?${parameters}`,
    signal,
  );
}

// 그룹 관리 기능을 구현하지 않고 다른 기능 소유자의 승인된 공개 조회만 사용한다.
export const getCodeHistoryGroups = (signal?: AbortSignal) =>
  apiGet<CodeHistoryGroup[]>("/api/admin/code-groups", signal);
