import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Icon from "../../src/components/Icon";

// Design tokens are a static asset contract; geometry is verified separately in browser tests.
const css = readFileSync(resolve("src/styles/tokens.css"), "utf8");
const root = css.slice(css.indexOf(":root"));
const sheet = new CSSStyleSheet();
sheet.insertRule(root, 0);
const tokens = (sheet.cssRules[0] as CSSStyleRule).style;

const colors = {
  primary: "#1D4ED8",
  "primary-hover": "#1E40AF",
  "primary-bg": "#EFF6FF",
  text: "#111827",
  "text-sub": "#4B5563",
  "text-disabled": "#9CA3AF",
  border: "#D1D5DB",
  divider: "#E5E7EB",
  bg: "#F9FAFB",
  surface: "#FFFFFF",
  "header-bg": "#F3F4F6",
  "readonly-bg": "#F3F4F6",
  success: "#15803D",
  "success-bg": "#F0FDF4",
  warning: "#B45309",
  "warning-bg": "#FFFBEB",
  danger: "#B91C1C",
  "danger-bg": "#FEF2F2",
  info: "#0369A1",
  "info-bg": "#F0F9FF",
  locked: "#4B5563",
  "locked-bg": "#F3F4F6",
};

describe("승인 디자인 토큰", () => {
  it.each(Object.entries(colors))("%s 색은 승인 값이다", (name, value) => {
    expect(tokens.getPropertyValue(`--${name}`).trim()).toBe(value);
  });
  it.each([
    ["title", 20, 28, 700],
    ["section", 16, 24, 600],
    ["kpi", 24, 32, 700],
    ["body", 14, 20, 400],
    ["table", 13, 20, 400],
    ["label", 13, 18, 500],
    ["caption", 12, 16, 400],
  ])("%s 타입 스케일을 제공한다", (name, size, line, weight) => {
    expect(tokens.getPropertyValue(`--font-${name}`).trim()).toBe(`${size}px`);
    expect(tokens.getPropertyValue(`--line-${name}`).trim()).toBe(`${line}px`);
    expect(tokens.getPropertyValue(`--weight-${name}`).trim()).toBe(
      `${weight}`,
    );
    expect(Number(size)).toBeGreaterThanOrEqual(12);
  });
  it("간격·모서리·그림자와 특별 치수를 분리한다", () => {
    for (const size of [4, 8, 12, 16, 24, 32]) {
      expect(tokens.getPropertyValue(`--space-${size}`).trim()).toBe(
        `${size}px`,
      );
    }
    expect(tokens.getPropertyValue("--radius-control").trim()).toBe("4px");
    expect(tokens.getPropertyValue("--radius-card").trim()).toBe("8px");
    expect(tokens.getPropertyValue("--header-height").trim()).toBe("56px");
    expect(tokens.getPropertyValue("--active-line").trim()).toBe("3px");
    expect(tokens.getPropertyValue("--shadow-dropdown").trim()).toBe(
      "0 2px 4px rgba(0, 0, 0, .08)",
    );
    expect(tokens.getPropertyValue("--shadow-overlay").trim()).toBe(
      "0 8px 24px rgba(0, 0, 0, .16)",
    );
  });
  it("실제 Pretendard WOFF2를 자체 제공하고 외부 CDN을 사용하지 않는다", () => {
    const font = readFileSync(resolve("public/fonts/PretendardVariable.woff2"));
    expect(font.subarray(0, 4).toString()).toBe("wOF2");
    expect(font.length).toBeGreaterThan(100000);
    expect(css).toContain("url('/fonts/PretendardVariable.woff2')");
    expect(css).not.toMatch(/https?:\/\//);
    expect(tokens.getPropertyValue("--font-family")).toContain("Malgun Gothic");
  });
  it("아이콘은 lucide SVG이며 장식용으로 숨긴다", () => {
    const { container } = render(<Icon name="grid" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector("svg")?.classList.toString()).toContain(
      "lucide",
    );
  });
});
