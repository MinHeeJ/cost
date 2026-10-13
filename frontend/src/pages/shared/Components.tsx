import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePreferences } from "../../stores/preferences";
import Icon from "../../components/Icon";
import { useScreenTabs } from "./tabs";
import styles from "./Workspace.module.css";

const sampleRows = Array.from({ length: 118 }, (_, index) => ({
  id: index + 1,
  name: `합성 예시 ${index + 1}`,
  amount: (index + 1) * 1000,
}));
const limit = (value: string, count: number) =>
  [...value].slice(0, count).join("");
export function amountError(value: string) {
  const normalized = value.replace(/[,\s원]/g, "");
  return /^\d+$/.test(normalized) && Number(normalized) <= 999999999999
    ? null
    : "금액은 0~999,999,999,999원의 정수로 입력해 주세요.";
}
export function mmError(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 3
    ? null
    : "MM은 0~3.00으로 입력해 주세요.";
}

/** Explicitly synthetic, local-only component examples; saving never calls a business API. */
export function Components() {
  const [form, setForm] = useState({
    name: "",
    project: "",
    amount: "",
    mm: "",
    business: "",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState(false);
  const [showAmount, setShowAmount] = useState(true);
  const [modal, setModal] = useState<"confirm" | "work" | "detail" | null>(
    null,
  );
  const [toast, setToast] = useState(false);
  const [warning, setWarning] = useState(true);
  const [tab, setTab] = useState("입력");
  const [selected, setSelected] = useState<number[]>([]);
  const [descending, setDescending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pageSize = usePreferences((state) => state.pageSize);
  const compact = usePreferences((state) => state.compact);
  const setPageSize = usePreferences((state) => state.setPageSize);
  const setCompact = usePreferences((state) => state.setCompact);
  const rows = sampleRows
    .filter((row) => row.name.includes(filter))
    .sort((a, b) => (descending ? b.id - a.id : a.id - b.id));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);
  function update(field: keyof typeof form, value: string) {
    setForm((state) => ({ ...state, [field]: value }));
    useScreenTabs.getState().setDirty("/dev/components", true);
    setSaved(false);
  }
  function validate(field: string) {
    if (field === "name")
      return form.name.trim() ? null : "이름·상호는 필수입니다.";
    if (field === "amount") return amountError(form.amount);
    if (field === "mm") return mmError(form.mm);
    return null;
  }
  function blur(field: string) {
    setErrors((state) => ({ ...state, [field]: validate(field) }));
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next = Object.fromEntries(
      ["name", "amount", "mm"].map((field) => [field, validate(field)]),
    );
    setErrors(next);
    const first = Object.keys(next).find((field) => next[field]);
    if (first) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      setSaved(true);
      setToast(true);
      useScreenTabs.getState().setDirty("/dev/components", false);
    }, 300);
  }
  const amount = form.amount.replace(/[,\s원]/g, "");
  return (
    <div className={styles.page}>
      <p>
        공통 부품 견본 — 아래 자료와 계산식은 합성 예시이며 서버에 저장하지
        않습니다.
      </p>
      <section className={styles.card}>
        <h2>입력 견본</h2>
        <form ref={formRef} onSubmit={save} noValidate>
          <div className={styles.formGrid}>
            <label>
              <span>
                이름·상호 <span className={styles.danger}>*</span>
              </span>
              <div>
                <input
                  name="name"
                  aria-label="이름·상호"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  value={form.name}
                  onChange={(event) =>
                    update("name", limit(event.target.value, 50))
                  }
                  onBlur={() => blur("name")}
                />
                <small>{[...form.name].length}/50</small>
                {errors.name && (
                  <p id="name-error" className={styles.danger}>
                    {errors.name}
                  </p>
                )}
              </div>
            </label>
            <label>
              <span>프로젝트명</span>
              <div>
                <input
                  aria-label="프로젝트명"
                  value={form.project}
                  onChange={(event) =>
                    update("project", limit(event.target.value, 100))
                  }
                />
                <small>{[...form.project].length}/100</small>
              </div>
            </label>
            <label>
              <span>
                금액 <span className={styles.danger}>*</span>
              </span>
              <div>
                <input
                  name="amount"
                  aria-label="금액"
                  inputMode="numeric"
                  className={styles.number}
                  aria-invalid={Boolean(errors.amount)}
                  value={form.amount}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[,\s원]/g, "");
                    update(
                      "amount",
                      /^\d+$/.test(raw)
                        ? Number(raw).toLocaleString("en-US")
                        : raw,
                    );
                  }}
                  onBlur={() => blur("amount")}
                />
                {errors.amount && (
                  <p className={styles.danger}>{errors.amount}</p>
                )}
              </div>
            </label>
            <label>
              <span>
                MM <span className={styles.danger}>*</span>
              </span>
              <div>
                <input
                  name="mm"
                  aria-label="MM"
                  inputMode="decimal"
                  className={styles.number}
                  aria-invalid={Boolean(errors.mm)}
                  value={form.mm}
                  onChange={(event) => update("mm", event.target.value)}
                  onBlur={() => blur("mm")}
                />
                {errors.mm && <p className={styles.danger}>{errors.mm}</p>}
                {!mmError(form.mm) && Number(form.mm) > 1 && (
                  <p className={styles.warning}>1.00 초과 (저장 가능)</p>
                )}
              </div>
            </label>
            <label>
              <span>날짜</span>
              <input type="date" aria-label="날짜" />
            </label>
            <label>
              <span>연월</span>
              <input type="month" aria-label="견본 연월" />
            </label>
            <label>
              <span>선택 상자</span>
              <select aria-label="선택 상자">
                <option>합성 예시 A</option>
                <option>합성 예시 B</option>
              </select>
            </label>
            <label>
              <span>사업자번호</span>
              <input
                aria-label="사업자번호"
                value={form.business}
                onChange={(event) => {
                  const digits = event.target.value.replace(/-/g, "");
                  if (!/^\d{0,10}$/.test(digits)) return;
                  const displayed =
                    digits.length > 5
                      ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
                      : digits.length > 3
                        ? `${digits.slice(0, 3)}-${digits.slice(3)}`
                        : digits;
                  update("business", displayed);
                }}
              />
            </label>
            <label>
              <span>비고·사유</span>
              <div>
                <textarea
                  aria-label="비고·사유"
                  value={form.note}
                  onChange={(event) =>
                    update("note", limit(event.target.value, 500))
                  }
                />
                <small>{[...form.note].length}/500</small>
              </div>
            </label>
            <label>
              <span>계산 칸</span>
              <div>
                <input
                  aria-label="계산 칸"
                  readOnly
                  value={amountError(form.amount) ? "–" : Number(amount) * 2}
                />
                <span title="합성 예시: 금액 + 금액 (원가 계산 아님)">
                  ⓘ 금액 + 금액 (예시)
                </span>
              </div>
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" disabled={busy} className={styles.primary}>
              {busy && (
                <span
                  role="status"
                  className={styles.spinner}
                  aria-label="처리 중"
                />
              )}
              {busy ? "처리 중…" : "저장: 검증 견본"}
            </button>
          </div>
          {saved && <p role="status">로컬 입력 검증을 완료했습니다.</p>}
        </form>
      </section>
      <section className={styles.card}>
        <h2>조회 조건·표 견본</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFilter(query);
            setPage(1);
          }}
        >
          <div className={styles.row}>
            <input
              aria-label="견본 검색어"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <details>
              <summary>상세 조건</summary>
              <label>
                예시 조건 <input aria-label="예시 조건" />
              </label>
            </details>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("");
                  setPage(1);
                }}
              >
                초기화
              </button>
              <button type="submit" className={styles.primary}>
                조회
              </button>
            </div>
          </div>
        </form>
        <div className={styles.row}>
          <p>총 {rows.length}건 · 단위: 원 (합성 예시)</p>
          <button type="button" onClick={() => setColumns(!columns)}>
            열 설정
          </button>
          <button
            type="button"
            aria-pressed={compact}
            onClick={() => setCompact(!compact)}
          >
            좁게 보기
          </button>
          {columns && (
            <label>
              <input
                type="checkbox"
                checked={showAmount}
                onChange={(event) => setShowAmount(event.target.checked)}
              />
              금액 열
            </label>
          )}
        </div>
        <div className={styles.tableScroll}>
          <table className={compact ? styles.dense : ""}>
            <thead>
              <tr>
                <th>선택</th>
                <th aria-sort={descending ? "descending" : "ascending"}>
                  <button
                    type="button"
                    onClick={() => setDescending(!descending)}
                  >
                    번호 {descending ? "▼" : "▲"}
                  </button>
                </th>
                <th>합성 예시 이름</th>
                {showAmount && <th className={styles.number}>금액 (원)</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${row.name} 선택`}
                      checked={selected.includes(row.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, row.id]
                            : selected.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td className={styles.center}>{row.id}</td>
                  <td>{row.name}</td>
                  {showAmount && (
                    <td className={styles.number}>
                      {row.amount.toLocaleString("en-US")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={showAmount ? 4 : 3}>
                  전체 합계:{" "}
                  {rows
                    .reduce((total, row) => total + row.amount, 0)
                    .toLocaleString("en-US")}
                  원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!rows.length && (
          <div role="status">
            <p>조건에 맞는 합성 예시가 없습니다.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("");
              }}
            >
              조건 초기화
            </button>
          </div>
        )}
        <div className={styles.row} aria-label="페이지 줄">
          <span>
            {rows.length ? (current - 1) * pageSize + 1 : 0}-
            {Math.min(current * pageSize, rows.length)} / {rows.length}건
          </span>
          <button
            type="button"
            aria-label="첫 페이지"
            disabled={current === 1}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          {Array.from({ length: Math.min(pages, 10) }, (_, index) => (
            <button
              type="button"
              key={index}
              aria-current={current === index + 1 ? "page" : undefined}
              onClick={() => setPage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
          <button
            type="button"
            aria-label="다음 페이지"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
          <button
            type="button"
            aria-label="마지막 페이지"
            disabled={current === pages}
            onClick={() => setPage(pages)}
          >
            »
          </button>
          <select
            aria-label="견본 목록 건수"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) as 20 | 50 | 100);
              setPage(1);
            }}
          >
            <option value="20">20건씩</option>
            <option value="50">50건씩</option>
            <option value="100">100건씩</option>
          </select>
        </div>
      </section>
      <section className={styles.card}>
        <h2>버튼·배지·탭·창 견본</h2>
        <div className={styles.row}>
          <button type="button" onClick={() => setModal("work")}>
            작업 창
          </button>
          <button type="button" onClick={() => setModal("detail")}>
            오른쪽 상세 창
          </button>
          <button type="button" onClick={() => setModal("confirm")}>
            확인 창
          </button>
          <button
            type="button"
            aria-label="일반 토스트"
            onClick={() => setToast(true)}
          >
            <Icon name="bell" />
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.success}>성공</span>
          <span className={styles.warning}>경고</span>
          <span className={styles.dangerBadge}>위험</span>
          <span className={styles.info}>안내</span>
          <span className={styles.locked}>잠김</span>
          <span className={styles.neutral}>구분</span>
        </div>
        <div
          role="tablist"
          aria-label="견본 밑줄 탭"
          className={styles.underlineTabs}
        >
          {["입력", "표", "상태"].map((name) => (
            <button
              role="tab"
              type="button"
              key={name}
              aria-selected={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <p role="tabpanel">{tab} 합성 예시</p>
        <div className={styles.summary}>
          <p>합성 예시 카드</p>
          <strong>118건</strong>
          <small>업무 지표 아님</small>
        </div>
        {warning && (
          <div className={styles.warning}>
            <p>합성 예시 경고</p>
            <button type="button" onClick={() => setWarning(false)}>
              확인했음
            </button>
          </div>
        )}
        <p className={styles.locked}>잠금 띠 견본 — 상태 변경 없음</p>
        <div
          className={styles.skeleton}
          role="status"
          aria-label="초기 로딩 견본"
        >
          읽는 중…
        </div>
      </section>
      {toast && (
        <p role="status" className={styles.toast}>
          로컬 견본 조작을 완료했습니다.
        </p>
      )}
      {modal && (
        <div className={styles.scrim}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={modal === "detail" ? "오른쪽 상세 창" : "견본 창"}
            className={modal === "detail" ? styles.drawer : styles.dialog}
          >
            <h2>
              {modal === "confirm"
                ? "확인 창"
                : modal === "work"
                  ? "작업 창"
                  : "오른쪽 상세 창"}
            </h2>
            <p>합성 예시 — 실제 자료를 변경하지 않습니다.</p>
            {modal === "work" && (
              <label>
                견본 입력 <input autoFocus aria-label="작업 창 입력" />
              </label>
            )}
            <div className={styles.actions}>
              <button type="button" onClick={() => setModal(null)}>
                닫기
              </button>
              <button
                type="button"
                className={
                  modal === "confirm" ? styles.dangerButton : styles.primary
                }
                onClick={() => {
                  setModal(null);
                  setToast(true);
                }}
              >
                {modal === "confirm" ? "삭제 견본" : "확인"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
