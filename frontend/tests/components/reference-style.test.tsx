import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "../../src/layout/Header";
import TitleBar from "../../src/layout/TitleBar";
import { Placeholder } from "../../src/pages/shared/Placeholder";
import { menuScreens, type MenuNode } from "../../src/pages/shared/api";
import menus from "../fixtures/shared-menus.json";

const shell = readFileSync(resolve("src/layout/Shell.module.css"), "utf8");
const workspace = readFileSync(
  resolve("src/pages/shared/Workspace.module.css"),
  "utf8",
);
// JSDOM does not resolve CSS custom properties. Parse real rules to verify the token-based visual contract.
function rule(css: string, selector: string) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
    (match) => match[1].trim() === selector,
  );
  const sheet = new CSSStyleSheet();
  sheet.insertRule(`${selector} { ${block?.[2] ?? ""} }`, 0);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

describe("레퍼런스 기반 공통 스타일", () => {
  it("브랜드는 복제 로고 대신 장식용 lucide 아이콘과 원문 이름을 제공한다", () => {
    render(
      <MemoryRouter>
        <Header onToggleMenu={() => {}} />
      </MemoryRouter>,
    );
    const brand = screen.getByRole("link", { name: "프로젝트·원가 관리" });
    expect(brand.querySelector("svg.lucide")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(brand).toHaveAttribute("href", "/UI-16");
    expect(rule(shell, ".brandIcon").getPropertyValue("background")).toBe(
      "var(--primary)",
    );
  });
  it("헤더 아이콘 버튼은 테두리 없는 36px 조작 영역이다", () => {
    render(
      <MemoryRouter>
        <Header onToggleMenu={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "알림" }).className).toContain(
      "iconButton",
    );
    expect(rule(shell, ".header button").getPropertyValue("border")).toBe("0");
    expect(rule(shell, ".header button").getPropertyValue("min-height")).toBe(
      "var(--control-height)",
    );
  });
  it("즐겨찾기는 눌림 상태를 표현하되 새 색상 토큰을 발명하지 않는다", () => {
    render(<TitleBar title="프로젝트" favorite onToggleFavorite={() => {}} />);
    const favorite = screen.getByRole("button", { name: "즐겨찾기" });
    expect(favorite).toHaveAttribute("aria-pressed", "true");
    expect(favorite.className).toContain("favoriteButton");
    expect(
      rule(shell, '.favoriteButton[aria-pressed="true"]').getPropertyValue(
        "color",
      ),
    ).toBe("var(--primary)");
  });
  it("업무 자리는 정확한 안내와 장식 아이콘만 갖는 흰 테두리 패널이다", () => {
    const entry = menuScreens(menus as MenuNode[]).find(
      (item) => item.screen_id === "UI-16",
    )!;
    render(<Placeholder screen={entry} />);
    const panel = screen.getByText("이 화면은 다음 단계에서 만듭니다.");
    expect(panel.querySelector("svg.lucide")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(panel.textContent).toBe("이 화면은 다음 단계에서 만듭니다.");
    expect(rule(workspace, ".placeholder").getPropertyValue("background")).toBe(
      "var(--surface)",
    );
    expect(rule(workspace, ".placeholder").getPropertyValue("border")).toBe(
      "var(--border-width) solid var(--divider)",
    );
    expect(rule(workspace, ".placeholder").getPropertyValue("box-shadow")).toBe(
      "",
    );
  });
  it("현재 화면 탭은 파란 밑줄이 아닌 회색 캔버스와 테두리로 구분한다", () => {
    const active = rule(workspace, ".tabActive");
    expect(active.getPropertyValue("background")).toBe("var(--bg)");
    expect(active.getPropertyValue("border-color")).toBe("var(--divider)");
    expect(active.getPropertyValue("border-bottom")).toBe("");
  });
  it("상위 메뉴는 40px 높이에 테두리 없이 정렬되며 펼침 화살표를 표시한다", () => {
    const group = rule(workspace, ".navGroup > button");
    expect(group.getPropertyValue("min-height")).toBe(
      "calc(var(--space-32) + var(--space-8))",
    );
    expect(group.getPropertyValue("border")).toBe("0");
    expect(
      rule(
        workspace,
        ".navGroup > button[aria-expanded]::after",
      ).getPropertyValue("content"),
    ).toBe('""');
  });
  it("기간 줄과 로딩 상태도 업무 카드와 같은 surface·divider 체계를 사용한다", () => {
    for (const selector of [".period", ".skeleton"]) {
      expect(rule(workspace, selector).getPropertyValue("border")).toBe(
        "var(--border-width) solid var(--divider)",
      );
    }
  });
  it("폼 안내와 빈 표는 caption 스케일로 정리하고 포커스·hover를 구별한다", () => {
    expect(
      rule(workspace, ".formGrid small").getPropertyValue("line-height"),
    ).toBe("var(--line-caption)");
    expect(
      rule(workspace, ".tableScroll tbody tr:hover td").getPropertyValue(
        "background",
      ),
    ).toBe("var(--readonly-bg)");
    expect(
      rule(workspace, ".formGrid textarea:focus").getPropertyValue(
        "border-color",
      ),
    ).toBe("var(--primary)");
  });
});
