export type PeriodType = "NONE" | "YEAR" | "MONTH" | "YEAR_CUM";
export interface ScreenDefinition {
  screenId: string;
  route: string;
  periodType: PeriodType;
}

// Only source-owned period metadata is fixed here; screen names and mobile flags come from the API.
const definitions: [string, PeriodType][] = [
  ["UI-16", "NONE"],
  ["UI-15", "NONE"],
  ["UI-02", "NONE"],
  ["UI-01", "YEAR"],
  ["UI-31", "NONE"],
  ["UI-12", "YEAR"],
  ["UI-05", "YEAR"],
  ["UI-11", "YEAR"],
  ["UI-28", "YEAR"],
  ["UI-17", "YEAR"],
  ["UI-29", "NONE"],
  ["UI-33", "NONE"],
  ["UI-13", "YEAR"],
  ["UI-03", "YEAR"],
  ["UI-04", "YEAR"],
  ["UI-19", "MONTH"],
  ["UI-32", "NONE"],
  ["UI-10", "YEAR"],
  ["UI-07", "YEAR_CUM"],
  ["UI-08", "YEAR_CUM"],
  ["UI-09", "YEAR_CUM"],
  ["UI-18", "YEAR_CUM"],
  ["UI-20", "MONTH"],
  ["UI-21", "YEAR"],
  ["UI-14", "MONTH"],
  ["UI-26", "NONE"],
  ["UI-30", "NONE"],
  ["UI-23", "NONE"],
  ["UI-24", "NONE"],
  ["UI-25", "NONE"],
  ["UI-27", "NONE"],
];
export const screenRegistry: ScreenDefinition[] = definitions.map(
  ([screenId, periodType]) => ({
    screenId,
    route: `/${screenId}`,
    periodType,
  }),
);
export const screenRoutes = [
  ...screenRegistry.map((screen) => screen.route),
  "/dev/components",
];
export const getScreenDefinition = (route: string) =>
  screenRegistry.find((screen) => screen.route === route);
