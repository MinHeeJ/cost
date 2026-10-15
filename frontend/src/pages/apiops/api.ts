import { apiGet } from "../../app/api-client";

export interface CodeOption {
  code: string;
  name: string;
  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
}

export interface ParamItem {
  param_key: string;
  effective_from: string;
  param_name: string;
  num_value: number | null;
  text_value: string | null;
  unit: string | null;
  used_in: string | null;
}

export const getCodes = (group: string, signal?: AbortSignal) =>
  apiGet<CodeOption[]>(`/api/codes/${encodeURIComponent(group)}`, signal);

export const getParam = (key: string, month: string, signal?: AbortSignal) =>
  apiGet<ParamItem>(
    `/api/params/${encodeURIComponent(key)}?${new URLSearchParams({ month })}`,
    signal,
  );
