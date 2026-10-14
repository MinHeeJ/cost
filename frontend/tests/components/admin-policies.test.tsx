import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Can, { can, type PermissionKey } from "../../src/components/Can";
import SensitiveCell, {
  type SensitiveColumn,
} from "../../src/components/SensitiveCell";
import ActorName, { actorName } from "../../src/components/ActorName";

const keys: PermissionKey[] = [
  "UI-25.read",
  "UI-25.create",
  "UI-25.update",
  "UI-27.delete",
  "UI-27.upload",
  "UI-27.download",
  "UI-27.confirm",
];

describe("관리 화면 공통 정책", () => {
  it.each(keys)("%s는 인증 없이 허용한다", (key) => {
    expect(can(key)).toBe(true);
  });

  it("메뉴 저장과 코드 추가 버튼은 원래 이벤트와 비활성 상태를 보존한다", async () => {
    const save = vi.fn();
    const create = vi.fn();
    render(
      <>
        <Can perm="UI-25.update">
          <button data-testid="menu-save-button" onClick={save}>
            메뉴 저장
          </button>
        </Can>
        <Can perm="UI-27.create">
          <button data-testid="code-create-button" onClick={create}>
            코드 추가
          </button>
        </Can>
        <Can perm="UI-25.create">
          <button data-testid="group-create-button" disabled>
            묶음 추가
          </button>
        </Can>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "메뉴 저장" }));
    await userEvent.click(screen.getByRole("button", { name: "코드 추가" }));
    expect(save).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "묶음 추가" })).toBeDisabled();
  });

  it("민감 표식이 있는 열도 원래 값을 마스킹하지 않는다", () => {
    const column: SensitiveColumn = {
      key: "attr1",
      label: "수당",
      sensitive: true,
    };
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <SensitiveCell sensitive={column.sensitive}>250000</SensitiveCell>
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("cell")).toHaveTextContent("250000");
  });

  it("NULL 변경 주체는 기본 사용자로 표시하고 문자열 ID는 정밀도를 유지한다", () => {
    render(<ActorName actor={null} />);
    expect(screen.getByText("기본 사용자")).toBeVisible();
    expect(actorName(undefined)).toBe("기본 사용자");
    expect(actorName("9007199254740993")).toBe("9007199254740993");
  });
});
