import { apiGet, apiRequest } from "../../app/api-client";

export interface ParamItem {
  param_key: string;
  effective_from: string;
  param_name: string;
  num_value: number | null;
  text_value: string | null;
  unit: string | null;
  used_in: string | null;
}

export interface ParamUpdate {
  effective_from: string;
  num_value?: string;
  text_value?: string;
}

export const getAdminParams = () => apiGet<ParamItem[]>("/api/admin/params");
export const getParamHistory = (key: string) =>
  apiGet<ParamItem[]>(`/api/admin/params/${encodeURIComponent(key)}/history`);

/** Keep all decimal input digits; JSON numeric tokens never pass through a JS double. */
export function updateParam(key: string, input: ParamUpdate) {
  if (
    input.num_value !== undefined &&
    !/^-?\d+(?:\.\d+)?$/.test(input.num_value)
  ) {
    throw new TypeError("숫자 형식을 확인해 주세요.");
  }
  const fields = [`"effective_from":${JSON.stringify(input.effective_from)}`];
  if (input.num_value !== undefined)
    fields.push(`"num_value":${input.num_value}`);
  if (input.text_value !== undefined)
    fields.push(`"text_value":${JSON.stringify(input.text_value)}`);
  return apiRequest<ParamItem>(`/api/admin/params/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: `{${fields.join(",")}}`,
  });
}

interface MonthCloseItem {
  close_month: string;
  status: "OPEN" | "CLOSED";
}

/** Existing range API has no global-cutoff projection; read the entire valid year range. */
export async function getLastClosedMonth() {
  const response = await apiGet<MonthCloseItem[]>(
    "/api/month-close?from=0000-01&to=9999-12",
  );
  return (response.data ?? []).reduce<string | null>(
    (last, item) =>
      item.status === "CLOSED" && (last === null || item.close_month > last)
        ? item.close_month
        : last,
    null,
  );
}
