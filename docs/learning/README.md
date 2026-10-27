# 기술 선택 학습 자료

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27
> 관련: [시스템 개요](../architecture/overview.md) · [ADR](../architecture/adr/) · [로드맵](../project/roadmap.md)

설계 문서에 나온 기술을 **그게 무엇인지 → 우리가 풀어야 하는 문제 → 다른 방식과의 비교 → 왜 이걸 골랐나 → 감수한 것 → 다시 검토할 때** 순서로 정리했어요. ADR이 "무엇을 정했다"라면, 여기는 그 결정을 이해하기 위한 배경 지식이에요. 결정 자체가 바뀌면 ADR을 먼저 고치고 이 문서를 맞춰요.

## 주제 목록

| # | 주제 | 우리가 고른 것 | 비교한 대안 | 관련 결정 |
| --- | --- | --- | --- | --- |
| [01](./01-realtime-data.md) | 실시간 데이터 받기 | 웹소켓 1개 (공용 수집기) | REST 폴링, 롱 폴링, SSE, 웹훅, 봇별 연결 | ADR-0007 |
| [02](./02-messaging-and-queues.md) | 프로세스 간 명령 전달 | Postgres 테이블 + LISTEN/NOTIFY | Redis Pub/Sub, BullMQ, RabbitMQ·Kafka, 폴링, pg-boss | ADR-0004 |
| [03](./03-process-structure.md) | 프로세스 구조 | 코드 하나, api·engine 프로세스 둘 | 단일 프로세스, 마이크로서비스 | ADR-0002 |
| [04](./04-backend-stack.md) | 서버 스택과 도구 | NestJS + TS, Vitest, npm workspaces | Express, FastAPI + pandas, 서버리스, Jest, pnpm·Turborepo | ADR-0001 |
| [05](./05-database-and-orm.md) | DB와 ORM | PostgreSQL + TypeORM | MySQL, SQLite, MongoDB, Prisma, Drizzle·Kysely | ADR-0001, 0004 |
| [06](./06-scheduling.md) | 배치 스케줄링 | @nestjs/schedule (engine 안) | OS cron, BullMQ 반복 작업, 외부 스케줄러 | ADR-0001 |
| [07](./07-rate-limiting.md) | 호출 한도 제어 | 그룹별 토큰 버킷 + 모자라면 건너뛰기 | 고정·슬라이딩 창, 큐에서 기다리기, 429 후 재시도 | ADR-0007 |
| [08](./08-order-safety.md) | 주문 안전 설계 | 기록 먼저 + 멱등 키, 증권사 조건주문 손절 | 주문 후 기록, 매핑 테이블, 아웃박스, 서버 손절, OCO | ADR-0003 |
| [09](./09-paper-broker.md) | 모의 체결 | 개발 점검용 PaperBroker | 증권사 모의서버, 사용자용 모의 모드, 모의 없음 | ADR-0005, Q-018 |
| [10](./10-deploy-and-access.md) | 배포와 접근 제어 | VM + Docker Compose, Tailscale | Kubernetes, PaaS, 서버리스, 앱 로그인, Cloudflare Access | ADR-0006 |
| [11](./11-notifications.md) | 알림 채널 | 텔레그램 봇 | 카카오톡, 알림톡, 웹 푸시, 이메일 | 리스크 관리 §8 |
| [12](./12-frontend.md) | 웹 화면 | Next.js + FSD (갱신 방식은 미정, 폴링 권장) | Vite SPA, SSE, 웹소켓 | ADR-0001 |
| [13](./13-external-data.md) | 외부 데이터 | 공식 API의 숫자·코드만 | 뉴스 API, LLM 요약, 예상 체결가 계산 | ADR-0008 |

## 읽는 순서

전체 구조를 먼저 잡고, 그다음 각 부품을 봐요.

```
구조       03 프로세스 구조 → 04 서버 스택 → 05 DB와 ORM
데이터 흐름 01 실시간 데이터 → 07 호출 한도 → 02 명령 전달 → 06 스케줄링
매매 안전  08 주문 안전 → 09 모의 체결 → 13 외부 데이터
운영·화면  10 배포와 접근 → 11 알림 → 12 웹 화면
```

## 사용 방법

- 각 문서의 **비교 표**를 보고 "우리 상황" 열을 직접 설명할 수 있으면 그 주제는 이해한 거예요
- **다시 검토할 때**에 적힌 상황이 생기면 ADR을 새로 쓰고 이 문서를 고쳐요
- 새 기술이 설계에 들어오면 같은 형식으로 번호를 이어 붙여요
