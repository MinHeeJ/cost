import { create } from "zustand";
export interface Period {
  year: number;
  month: number;
}
function today(): Period {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === "year")!.value),
    month: Number(parts.find((part) => part.type === "month")!.value),
  };
}
export const currentPeriod = today;
export const monthKey = (period: Period) =>
  `${String(period.year).padStart(4, "0")}-${String(period.month).padStart(2, "0")}`;
interface PeriodsState {
  periods: Record<string, Period>;
  setPeriod: (screenId: string, period: Period) => void;
  reset: () => void;
}
export const usePeriods = create<PeriodsState>((set) => ({
  periods: {},
  setPeriod: (screenId, period) =>
    set((state) => ({ periods: { ...state.periods, [screenId]: period } })),
  reset: () => set({ periods: {} }),
}));
