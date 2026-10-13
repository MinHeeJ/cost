# UI 개선 계약 체크리스트와 검증 근거

## 범위와 연결

ui-design.md 상단 BASIC-87 인계가 우선한다. 31개 업무 자리와 /dev/components, 공개 GET 3개만 유지한다.
업무 생성/수정/삭제 API가 없으므로 등록·저장·삭제 CTA나 가짜 업무 데이터는 추가하지 않는다.
React Router + Zustand + lucide-react + CSS Modules를 유지한다. 새로운 UI 라이브러리 없음.

- 메뉴: Workspace → getMenus → apiGet → GET /api/menus → MenuController/Service → MenuMapper → sys_menu.
- 표시: menu_name, screen_id, icon, parent_menu_id, sort_order, mobile_yn; BIGINT ID는 문자열.
- 월 상태: PeriodBar → getMonthClose(from,to) → MonthCloseController/Service → mapper → fin_month_close.
- 응답: {success:true,meta:{},data}; 월 DTO는 close_month/status; 쓰기 payload 없음.
- 오류: code/message/field/requestId를 기존 ErrorBanner에 표시, 연결 오류는 서버 응답 없음.
- health: 실행 확인만, 제품 카드·메뉴 없음.

## 화면별 코딩 전 체크리스트

모든 업무 화면 공통: API 이름/ID/그룹을 표시, 원문 자리 안내 유지; 로딩·오류·빈 메뉴·누락 메뉴 처리.
기간 없는 화면은 기간 줄 없음. YEAR은 연도, YEAR_CUM은 연도/누계 종료 월, MONTH는 선택 월 GET 조회.
MONTH의 CLOSED는 잠금띠와 경고(확인했음으로 경고만 닫기); OPEN은 작업중. 빈 응답은 재조회.
모든 메뉴 필드는 읽기 전용. 인증·권한 분기 없음. mobile_yn=N은 모바일 메뉴에서 제외하고 직접접근 PC 안내.
탭 전환은 상태 보존, dirty 닫기·9번째 교체는 확인, 대시보드는 제거 금지, 성공 후 route/기간 유지.

| route | 메뉴 경로/사용자 목적 | archetype | CTA | field behavior | API/action | 성공 |
| --- | --- | --- | --- | --- | --- | --- |
| /UI-16 | 프로젝트·원가 관리 > 대시보드 > 대시보드 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-15 | 프로젝트·원가 관리 > 기준정보 > 거래처·영업 파트 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-02 | 프로젝트·원가 관리 > 기준정보 > 개발자 풀 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-01 | 프로젝트·원가 관리 > 프로젝트·투입 > 프로젝트 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-31 | 프로젝트·원가 관리 > 프로젝트·투입 > 프로젝트 현황판 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-12 | 프로젝트·원가 관리 > 프로젝트·투입 > 투입 배정 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-05 | 프로젝트·원가 관리 > 프로젝트·투입 > 철수 리스트 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-11 | 프로젝트·원가 관리 > 프로젝트·투입 > 인원 계획 대비 투입 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-28 | 프로젝트·원가 관리 > 인력 계획 > 인력 운영 보드 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-17 | 프로젝트·원가 관리 > 인력 계획 > 인력 수요 예측 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-29 | 프로젝트·원가 관리 > 인력 계획 > 영업 파이프라인 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-33 | 프로젝트·원가 관리 > 인력 계획 > 외부 인력 후보 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-13 | 프로젝트·원가 관리 > 매출 > 청구·입금 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-03 | 프로젝트·원가 관리 > 원가·수익 > 개인 원가·수익표 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-04 | 프로젝트·원가 관리 > 원가·수익 > 프로젝트 원가 분석 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-19 | 프로젝트·원가 관리 > 원가·수익 > 영업 파트 이익금 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus; GET /api/month-close | 같은 route 유지 |
| /UI-32 | 프로젝트·원가 관리 > 원가·수익 > 단가 재협상 대상 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-10 | 프로젝트·원가 관리 > 재무·자금 > 재무 항목 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-07 | 프로젝트·원가 관리 > 재무·자금 > 전체 수익 구조 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-08 | 프로젝트·원가 관리 > 재무·자금 > 영업이익표 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-09 | 프로젝트·원가 관리 > 재무·자금 > 순이익표 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-18 | 프로젝트·원가 관리 > 재무·자금 > 사업계획 대비 실적 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-20 | 프로젝트·원가 관리 > 재무·자금 > 지급 관리 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus; GET /api/month-close | 같은 route 유지 |
| /UI-21 | 프로젝트·원가 관리 > 재무·자금 > 자금수지표 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-14 | 프로젝트·원가 관리 > 마감 > 월 마감 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus; GET /api/month-close | 같은 route 유지 |
| /UI-26 | 프로젝트·원가 관리 > AI > AI 분석 도우미 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-30 | 프로젝트·원가 관리 > AI > AI 인력 추천 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-23 | 프로젝트·원가 관리 > 시스템 > 사용자 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-24 | 프로젝트·원가 관리 > 시스템 > 권한 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-25 | 프로젝트·원가 관리 > 시스템 > 메뉴 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /UI-27 | 프로젝트·원가 관리 > 시스템 > 공통코드 | navigation/placeholder | 메뉴 선택·즐겨찾기·기간 이동 | 메뉴 DTO readonly; 기간은 registry | GET /api/menus | 같은 route 유지 |
| /dev/components | 비메뉴 직접 진입; 공통 입력/표/창 조작 | component showcase | 로컬 검증·창 열기·페이지 이동 | 계산값 readonly, 길이·금액·MM 검증 | 서버 쓰기 없음 | 로컬 검증 안내·dirty 해제 |

견본은 기존 합성 예시를 유지하되 업무 데이터로 사용하지 않는다. 서버 계약·DB·seed 수정 없음.

## 레퍼런스 실제 브라우저 관찰

설치된 Playwright 1.51.1 Chromium으로 ref.html에 직접 접속했다.
1440px 대시보드/프로젝트 목록/프로젝트 등록, 375px, 메뉴 접힘 64px, Ctrl+K/Esc를 관찰했다.
흰 56px 헤더·240px 메뉴·회색 canvas·회색 bordered active tab·파란 활성 메뉴·테두리 카드·자체 글꼴을 적용한다.
참조 사이트의 AI·알림 count·사용자 계정·KPI·저장·엑셀·다크모드는 명세 제외 범위이므로 복사하지 않는다.
스크린샷: /tmp/basic87-reference.png, /tmp/basic87-reference-project.png, /tmp/basic87-reference-form.png.

## 검증

실행 결과는 작업 완료 시 아래에 기록한다.
