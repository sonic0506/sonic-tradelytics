# ADR-0001. 기술 스택: NestJS + Next.js + PostgreSQL

- 상태: 제안
- 날짜: 2026-10-26

## 맥락

1인 개발이고, 코딩 규칙을 도구로 강제하는 하네스(`sonic-harness-be`: NestJS + TypeORM + PostgreSQL + Vitest, `sonic-harness-fe`: React/Next.js + FSD)를 이미 갖고 있어요. 자금·리스크 로직은 타입 안정성과 테스트가 중요해요.

## 결정

- 서버(api, engine): NestJS 12 + TypeORM + PostgreSQL + Vitest, `sonic-harness-be` 적용
- 웹: Next.js, `sonic-harness-fe` 적용, 디자인은 sonic-ui
- 저장소: 모노레포 하나 (`apps/server`, `apps/web`), npm workspaces
- 배치: engine 안 스케줄러. 정해진 시각이 몇 개뿐인 동안은 `setTimeout`으로 예약하고, cron 표현이 필요해지면 `@nestjs/schedule`을 써요 (2026-10-29, [engine 배치 스케줄](../engine.md#배치-스케줄))
- 알림: 텔레그램 Bot API

## 결과

- 이미 검증한 규칙·CI·테스트 구성을 그대로 써서 초기 설정 비용이 작아요
- 서버와 웹이 TypeScript라 API 타입을 공유할 수 있어요
- 감수: 수치 분석(백테스트 통계)은 Python 생태계보다 도구가 적어요. 필요해지면 백테스트만 별도로 검토해요

## 검토한 대안

- Python(FastAPI) + pandas: 분석은 편하지만 기존 하네스를 못 써요
- 서버리스: 장중 상주 루프와 고정 IP 요구에 맞지 않아요
