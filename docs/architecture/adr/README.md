# ADR (Architecture Decision Records)

기술 결정과 그 이유를 남겨요. 승인된 ADR은 고치지 않고, 결정을 바꿀 때는 새 ADR을 쓰고 이전 ADR 상태를 "대체됨(ADR-XXXX)"으로 바꿔요.

## 목록

| ADR | 제목 | 상태 |
| --- | --- | --- |
| [0001](./0001-tech-stack.md) | 기술 스택: NestJS + Next.js + PostgreSQL | 제안 |
| [0002](./0002-split-api-and-engine.md) | api와 매매 engine을 별도 프로세스로 분리 | 제안 |
| [0003](./0003-record-decision-before-order.md) | 판단 기록을 먼저 저장하고, 그 id를 clientOrderId로 주문 | 제안 |
| [0004](./0004-postgres-notify-for-commands.md) | 프로세스 간 명령은 Postgres LISTEN/NOTIFY로 전달 | 제안 |
| [0005](./0005-in-house-paper-broker.md) | 개발 점검용 모의 체결은 자체 구현, 규칙은 순수 함수로 공유 | 제안 |
| [0006](./0006-network-level-access-control.md) | 관리 화면은 앱 로그인 대신 네트워크로 접근 제한 | 제안 |
| [0007](./0007-single-market-collector.md) | 시세는 공용 수집기 한 곳에서 웹소켓으로 받아 봇들이 공유 | 제안 |
| [0008](./0008-external-data-numeric-only.md) | 외부 데이터는 숫자·코드로 바꿀 수 있는 공식 API만 판단에 사용 | 제안 |

## 템플릿

```markdown
# ADR-XXXX. 제목

- 상태: 제안 | 승인 | 대체됨(ADR-YYYY) | 폐기
- 날짜: YYYY-MM-DD

## 맥락
무엇이 문제이고 어떤 제약이 있는지.

## 결정
무엇을 하기로 했는지.

## 결과
좋아지는 것, 감수하는 것.

## 검토한 대안
대안과 고르지 않은 이유.
```
