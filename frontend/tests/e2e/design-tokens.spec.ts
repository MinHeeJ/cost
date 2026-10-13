import { test, expect } from "@playwright/test";

test("자체 글꼴·색·타입과 56px 헤더를 실제 브라우저에서 확인한다", async ({
  page,
}) => {
  const externalFonts: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "font" &&
      !new URL(request.url()).pathname.startsWith("/fonts/")
    ) {
      externalFonts.push(request.url());
    }
  });
  await page.goto("/UI-03");
  await page.evaluate(() => document.fonts.ready);
  const font = await page.request.get("/fonts/PretendardVariable.woff2");
  expect(font.ok()).toBeTruthy();
  expect((await font.body()).subarray(0, 4).toString()).toBe("wOF2");
  expect(
    await page.evaluate(() => document.fonts.check("14px Pretendard")),
  ).toBeTruthy();
  expect(externalFonts).toEqual([]);
  await expect(page.getByRole("banner")).toHaveCSS("height", "56px");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-size",
    "20px",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "line-height",
    "28px",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "font-weight",
    "700",
  );
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(249, 250, 251)",
  );
});
