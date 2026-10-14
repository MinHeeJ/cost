import { test, expect } from "@playwright/test";
import { screenRegistry } from "../../src/pages/shared/registry";

test("모든 업무 route는 실제 메뉴 이름과 기간 계약을 표시한다", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/menus");
  expect(response.ok()).toBeTruthy();
  const { data } = await response.json();
  const entries = data.flatMap(
    (group: { children: { screen_id: string; menu_name: string }[] }) =>
      group.children,
  );
  for (const definition of screenRegistry) {
    const entry = entries.find(
      (item: { screen_id: string }) => item.screen_id === definition.screenId,
    );
    expect(entry).toBeDefined();
    await page.goto(definition.route);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: entry.menu_name,
        exact: true,
      }),
    ).toBeVisible();
    if (definition.route === "/UI-25") {
      await expect(
        page.getByRole("table", { name: "전체 메뉴 편집" }),
      ).toBeVisible();
    } else if (definition.route === "/UI-27") {
      await expect(page.getByTestId("common-code-page")).toBeVisible();
      await page.getByRole("tab", { name: "기준값", exact: true }).click();
      await expect(page.getByTestId("params-panel")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "기준값", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("region", {
          name: `${entry.menu_name} 업무 자리`,
          exact: true,
        }),
      ).toHaveText("이 화면은 다음 단계에서 만듭니다.");
    }
    const period = page.getByRole("region", { name: "화면 기간" });
    if (definition.periodType === "NONE") await expect(period).toHaveCount(0);
    else await expect(period).toBeVisible();
  }
});

test("태블릿 메뉴를 펼치면 라벨과 선택 메뉴가 본문 흐름에 표시된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/UI-01");
  await expect(
    page.getByRole("heading", { level: 1, name: "프로젝트", exact: true }),
  ).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "업무 메뉴" });
  await expect(
    navigation.getByText("프로젝트·투입", { exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "메뉴 열기/접기" }).click();
  await expect(
    navigation.getByText("프로젝트·투입", { exact: true }),
  ).toBeVisible();
  await navigation
    .getByRole("button", { name: "프로젝트 현황판", exact: true })
    .click();
  await expect(page).toHaveURL(/\/UI-31$/);
});

test("모바일 메뉴·PC 안내·기간 상태는 실제 API와 연결된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/UI-14");
  await expect(page.getByText("PC에서 이용해 주세요")).toBeVisible();
  await page.getByRole("button", { name: "대시보드로", exact: true }).click();
  await expect(page).toHaveURL(/\/UI-16$/);
  await page.getByRole("button", { name: "메뉴 열기/접기" }).click();
  const navigation = page.getByRole("navigation", { name: "업무 메뉴" });
  await expect(
    navigation.getByRole("button", { name: "월 마감", exact: true }),
  ).toHaveCount(0);
  await navigation
    .getByRole("button", { name: "원가·수익", exact: true })
    .click();
  await navigation
    .getByRole("button", { name: "영업 파트 이익금", exact: true })
    .click();
  await expect(page).toHaveURL(/\/UI-19$/);
  const period = page.getByRole("region", { name: "화면 기간" });
  await period.getByLabel("연월", { exact: true }).fill("2026-09");
  await expect(
    period.getByText("마감된 달입니다. 수정·삭제할 수 없습니다."),
  ).toBeVisible();
  await period.getByRole("button", { name: "확인했음", exact: true }).click();
  await expect(period.getByText("마감 상태를 확인해 주세요.")).toBeHidden();
  await period.getByLabel("연월", { exact: true }).fill("2026-10");
  await expect(period.getByText("작업중", { exact: true })).toBeVisible();
});

test("견본 dirty 입력은 검색/탭 이동 후 보존되고 닫기 확인 Esc는 취소한다", async ({
  page,
}) => {
  await page.goto("/dev/components");
  const input = page.getByLabel("이름·상호", { exact: true });
  await input.fill("보존할 입력");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "화면 이름 검색" });
  await dialog.getByLabel("화면 이름 검색어").fill("프로젝트 현황판");
  await dialog
    .getByRole("button", { name: "프로젝트 현황판", exact: true })
    .click();
  await expect(page).toHaveURL(/\/UI-31$/);
  await page.getByRole("tab", { name: /공통 부품 견본/ }).click();
  await expect(input).toHaveValue("보존할 입력");
  await page.getByRole("button", { name: "공통 부품 견본 닫기" }).click();
  await expect(
    page.getByRole("dialog", { name: "화면 닫기 확인" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "화면 닫기 확인" }),
  ).toBeHidden();
  await expect(input).toHaveValue("보존할 입력");
});
