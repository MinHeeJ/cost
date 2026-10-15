import { test, expect } from "@playwright/test";

test("공개 메뉴에서 기준값·전체 적용 이력을 읽고 닫아도 탭을 유지한다", async ({
  page,
  request,
}) => {
  const menuResponse = await request.get("/api/menus");
  expect(menuResponse.ok()).toBeTruthy();
  const { data: menus } = await menuResponse.json();
  const group = menus.find((item: { children: { screen_id: string }[] }) =>
    item.children.some((child) => child.screen_id === "UI-27"),
  );
  expect(group).toBeDefined();
  const entry = group.children.find(
    (item: { screen_id: string }) => item.screen_id === "UI-27",
  );
  await page.goto("/UI-16");
  const navigation = page.getByRole("navigation", { name: "업무 메뉴" });
  await navigation
    .getByRole("button", { name: group.menu_name, exact: true })
    .click();
  await navigation
    .getByRole("button", { name: entry.menu_name, exact: true })
    .click();
  await expect(page).toHaveURL(/\/UI-27$/);
  await page.getByRole("tab", { name: "기준값", exact: true }).click();
  const panel = page.getByTestId("params-panel");
  await expect(panel).toBeVisible();
  const response = await request.get("/api/admin/params");
  expect(response.ok()).toBeTruthy();
  const { data: items } = await response.json();
  if (items.length === 0) {
    await expect(
      panel.getByText("현재 적용 가능한 기준값이 없습니다."),
    ).toBeVisible();
    return;
  }
  const selected = items[0];
  const row = panel
    .getByRole("row")
    .filter({ has: page.getByText(selected.param_name, { exact: true }) });
  await row.getByRole("button", { name: "이력 보기" }).click();
  const dialog = page.getByRole("dialog", {
    name: "기준값 적용 이력",
    exact: true,
  });
  const historyResponse = await request.get(
    `/api/admin/params/${encodeURIComponent(selected.param_key)}/history`,
  );
  expect(historyResponse.ok()).toBeTruthy();
  const { data: history } = await historyResponse.json();
  for (const item of history) {
    await expect(
      dialog.getByTestId(`param-history-row-${item.effective_from}`),
    ).toContainText(item.effective_from);
  }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
});

test("기준값 초안 취소는 저장 요청 없이 입력을 폐기한다", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/admin/params");
  expect(response.ok()).toBeTruthy();
  const { data: items } = await response.json();
  test.skip(items.length === 0, "전용 대상 DB에 현재 기준값이 없음");
  const writes: string[] = [];
  page.on("request", (call) => {
    if (call.method() === "PUT" && call.url().includes("/api/admin/params/"))
      writes.push(call.url());
  });
  await page.goto("/UI-27");
  await page.getByRole("tab", { name: "기준값", exact: true }).click();
  const row = page
    .getByTestId("params-panel")
    .getByRole("row")
    .filter({ has: page.getByText(items[0].param_name, { exact: true }) });
  await row.getByRole("button", { name: "값 변경" }).click();
  const dialog = page.getByRole("dialog", { name: "값 변경", exact: true });
  await dialog
    .getByLabel("새 값", { exact: true })
    .fill(items[0].num_value === null ? "검증 초안" : "11");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(writes).toEqual([]);
});
