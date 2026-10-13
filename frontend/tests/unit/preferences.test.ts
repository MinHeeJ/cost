import { beforeEach, describe, expect, it } from "vitest";
import {
  loadPreferences,
  preferenceKeys,
  usePreferences,
} from "../../src/stores/preferences";

beforeEach(() => {
  localStorage.clear();
  usePreferences.getState().reload();
});

describe("다섯 si. 설정과 최근 화면", () => {
  it("접힘·건수·밀도를 각각 저장하고 복원한다", () => {
    const preferences = usePreferences.getState();
    preferences.setMenuCollapsed(true);
    preferences.setPageSize(100);
    preferences.setCompact(true);
    expect(localStorage.getItem("si.menuCollapsed")).toBe("true");
    expect(localStorage.getItem("si.pageSize")).toBe("100");
    expect(localStorage.getItem("si.compact")).toBe("true");
    expect(loadPreferences()).toMatchObject({
      menuCollapsed: true,
      pageSize: 100,
      compact: true,
    });
  });
  it("즐겨찾기를 복원하고 11번째 추가는 기존 목록을 변경하지 않는다", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `screen-${i}`);
    expect(usePreferences.getState().setFavorites(ids)).toBe(true);
    expect(loadPreferences().favorites).toEqual(ids);
    expect(usePreferences.getState().setFavorites([...ids, "extra"])).toBe(
      false,
    );
    expect(loadPreferences().favorites).toEqual(ids);
  });
  it("최근 화면은 중복 없는 MRU 다섯 개를 저장·복원한다", () => {
    const store = usePreferences.getState();
    for (let i = 0; i < 6; i++)
      store.recordRecent({
        screenId: `${i}`,
        name: `화면 ${i}`,
        route: `/screen-${i}`,
      });
    store.recordRecent({ screenId: "3", name: "화면 3", route: "/screen-3" });
    expect(
      loadPreferences().recentScreens.map((item) => item.screenId),
    ).toEqual(["3", "5", "4", "2", "1"]);
    expect(localStorage.getItem(preferenceKeys.recentScreens)).not.toBeNull();
  });
  it("손상된 저장 자료를 안전하게 무시한다", () => {
    localStorage.setItem(preferenceKeys.favorites, "invalid");
    localStorage.setItem(preferenceKeys.pageSize, "999");
    localStorage.setItem(preferenceKeys.recentScreens, '[null,{},"bad"]');
    expect(loadPreferences()).toEqual({
      favorites: [],
      recentScreens: [],
      menuCollapsed: false,
      pageSize: 50,
      compact: false,
    });
  });
});
