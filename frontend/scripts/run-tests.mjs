import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const isE2e = (arg) => arg.replaceAll("\\", "/").includes("tests/e2e/");
const hasE2e = args.some(isE2e);
const hasUnit = args.some((arg) => /\.test\.tsx?$/.test(arg));

if (hasE2e && hasUnit) {
  console.error("Run Playwright E2E and Vitest unit selections separately.");
  process.exit(1);
}

const runner = hasE2e
  ? "../node_modules/@playwright/test/cli.js"
  : "../node_modules/vitest/vitest.mjs";
const runnerArgs = hasE2e
  ? ["test", ...args.filter((arg) => arg !== "--run")]
  : ["run", ...args.filter((arg) => arg !== "--run")];

if (hasE2e) {
  const { chromium } = await import("@playwright/test");
  if (!existsSync(chromium.executablePath())) {
    console.error(
      "Installed Chromium not found. Check PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright.",
    );
    process.exit(1);
  }
}

const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL(runner, import.meta.url)), ...runnerArgs],
  {
    stdio: "inherit",
  },
);

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
