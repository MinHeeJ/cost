# cost

Initialized by AIOps Code Agent.

## 실행

Java 17 / Spring Boot 3.3 / MyBatis XML / Flyway / PostgreSQL 16과
React 18 / TypeScript / Vite 5 / npm을 사용합니다. 인증과 권한 기능은 없습니다.

저장소 루트에서 `docker compose -f infra/docker-compose.yml up --build`로 실행합니다.
frontend 기본 포트는 3000, backend 기본 포트는 8080입니다.
frontend는 `/api/`를 backend로 프록시하며 DB는 host 포트를 노출하지 않습니다.
`GET /api/health`는 `{success:true,meta:{}}`와 서버 생성 UUID `X-Request-Id`를 반환합니다.

Compose의 DB 접속 설정은 개발 전용 기본값입니다. 운영에서는 DB_NAME, DB_USER,
DB_PASSWORD 및 필요한 published port 설정을 안전한 배포 환경에서 반드시 덮어써야 합니다.
비밀번호나 토큰을 저장소에 넣지 않습니다. DB_URL/DB_USERNAME/DB_PASSWORD는 backend
환경변수이고 Compose가 제공합니다. 메뉴와 월 마감은 V1 migration에서 초기화됩니다.

Frontend: `npm ci`, `npm run test -- --run`, `npm run typecheck`, `npm run build`.
브라우저 회귀는 실행된 frontend를 대상으로 `npm run test:e2e`를 사용합니다.
`PLAYWRIGHT_BASE_URL`은 선택 사항이며 기본값은 http://localhost:3000입니다.
Backend의 JUnit/MockMvc 테스트는 DB 없이 동작합니다. 실제 PostgreSQL 16 schema/seed 및
health 불변성 테스트는 TEST_DB_URL이 있을 때만 실행하며 TEST_DB_USERNAME과
TEST_DB_PASSWORD를 사용합니다. 각각의 테스트는 임의 격리 schema를 생성·삭제합니다.

Pretendard v1.3.9 variable WOFF2는 frontend/public/fonts에서 직접 제공합니다.
라이선스는 같은 디렉터리의 OFL.txt를 참조합니다. 외부 글꼴 CDN은 사용하지 않습니다.
