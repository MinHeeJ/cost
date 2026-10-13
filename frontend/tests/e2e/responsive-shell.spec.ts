import { test, expect } from "@playwright/test";

for (const width of [1280, 1024, 375, 360]) {
  test(`공개 shell ${width}px 배치와 입력 제어`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/UI-03");
    await expect(page.getByRole("banner")).toHaveCSS("height", "56px");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const main = await page.getByRole("main").boundingBox();
    const title = await heading.boundingBox();
    expect(main).not.toBeNull();
    expect(title!.x - main!.x).toBe(width >= 1280 ? 24 : 16);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: /기본 사용자|화면 설정/ }).click();
    await page.getByLabel("목록 기본 건수").selectOption("100");
    await page.getByLabel("좁게 보기").check();
    if (width <= 767) {
      await expect(page.locator("body")).toHaveCSS("font-size", "16px");
      const control = await page.getByLabel("목록 기본 건수").boundingBox();
      expect(control!.height).toBeGreaterThanOrEqual(44);
    }
    await page.reload();
    await page.getByRole("button", { name: /기본 사용자|화면 설정/ }).click();
    await expect(page.getByLabel("목록 기본 건수")).toHaveValue("100");
    await expect(page.getByLabel("좁게 보기")).toBeChecked();
  });
}
