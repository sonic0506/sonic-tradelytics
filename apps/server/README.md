# API

NestJS 12 + TypeORM + PostgreSQL 서버예요. 규칙은 [AGENTS.md](./AGENTS.md)와 `.sonic-harness-be/harness.md`에 있어요.

## 시작하기

```bash
cp .env.example .env   # DATABASE_URL, JWT_SECRET을 바꿔요
npm ci
npm run migration:run
npm run start:dev      # API 문서: http://localhost:3000/docs
```

## 명령어

| 명령어                                                               | 하는 일                                           |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| `npm run lint`, `npm run typecheck`                                  | 규칙·타입 검사                                    |
| `npm test`, `npm run test:e2e`                                       | 단위 테스트, e2e(Docker 필요)                     |
| `npm run migration:generate -- src/infra/database/migrations/<이름>` | entity 변경으로 migration 만들기                  |
| `npm run openapi`                                                    | `openapi.json` 다시 만들기(API를 바꾸면 커밋해요) |
