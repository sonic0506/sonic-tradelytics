# 05. 데이터베이스와 ORM: PostgreSQL + TypeORM

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27 · 상위: [기술 선택 학습 자료](./README.md)
> 관련 결정: [ADR-0001](../architecture/adr/0001-tech-stack.md) · [ADR-0004](../architecture/adr/0004-postgres-notify-for-commands.md) · [데이터 모델](../architecture/data-model.md)

## 한 줄 요약

PostgreSQL 하나가 **데이터 저장 + 프로세스 간 알림 + 잠금**을 모두 맡아요. ORM은 하네스에 맞춰 TypeORM을 써요.

## 먼저 알아둘 용어

| 용어 | 무엇인가 |
| --- | --- |
| 관계형 DB (RDBMS) | 표(테이블)와 관계로 데이터를 저장하고 SQL로 조회. PostgreSQL, MySQL, SQLite |
| 문서형 DB | JSON 문서를 그대로 저장. MongoDB |
| 트랜잭션 | 여러 변경을 "모두 성공 또는 모두 실패"로 묶는 단위 |
| ORM | DB 테이블을 코드의 클래스·객체로 다루게 해주는 도구. TypeORM, Prisma |
| 쿼리 빌더 | SQL을 코드로 조립하는 도구. ORM보다 SQL에 가까워요. Kysely, Knex, Drizzle |
| 마이그레이션 | 스키마 변경을 파일로 버전 관리하고 순서대로 적용하는 것 |
| 어드바이저리 락 | Postgres가 제공하는 애플리케이션용 잠금. "engine은 하나만" 같은 규칙에 써요 |
| 부분 유니크 인덱스 | 조건에 맞는 행에만 유니크 제약. "해제 안 된 종목 잠금은 종목당 1개" |
| `jsonb` | Postgres의 JSON 컬럼. 근거 카드처럼 모양이 유형마다 다른 데이터에 써요 |

## 우리가 풀어야 하는 문제

- 돈 계산과 기록은 **정확하고 일관돼야** 해요 (트랜잭션, 정수 금액)
- 근거·주문·체결 기록은 **추가만** 하고 지우지 않아요 (NFR-04)
- 프로세스 간 명령 전달과 잠금이 필요해요
- 근거 카드처럼 **유형마다 모양이 다른** 데이터가 있어요
- 운영할 서버는 적을수록 좋아요

## 선택지 비교

**데이터베이스**

| 선택지 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **PostgreSQL** | 트랜잭션, `jsonb`, LISTEN/NOTIFY, 어드바이저리 락, 부분 인덱스를 모두 기본 제공 | 서버를 띄워야 함 | 하나로 저장·알림·잠금 해결 |
| MySQL | 널리 쓰임 | LISTEN/NOTIFY 없음, JSON·부분 인덱스 기능이 약함 | 명령 전달용 다른 도구가 필요 |
| SQLite | 파일 하나, 설정 없음 | 여러 프로세스가 동시에 쓰기 약함, 알림 기능 없음 | api·engine 2개 프로세스에 불리 |
| MongoDB | 모양이 다른 문서 저장 편함 | 돈 계산의 여러 문서 트랜잭션·관계 조회가 RDB보다 불편 | 정확성이 우선이라 RDB |

**ORM / 쿼리 도구**

| 선택지 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **TypeORM** | NestJS 공식 연동, 하네스 기본값, 데코레이터로 엔티티 정의 | 타입 추론이 약한 부분, 복잡한 쿼리는 결국 SQL | 하네스에 맞춰 채택 |
| Prisma | 스키마 파일 하나에서 타입 생성, 타입 안전성 좋음 | 하네스와 다름, Postgres 고유 기능(LISTEN 등)은 별도 처리 | 하네스를 바꿀 정도의 이득은 아님 |
| Drizzle / Kysely | SQL에 가깝고 타입 안전 | ORM 편의 기능이 적음 | 복잡한 집계 쿼리에서 고려할 만함 |

## 선택과 이유

- PostgreSQL 하나로 저장, 명령 전달([02](./02-messaging-and-queues.md)), engine 단일 실행 잠금, 종목 잠금을 모두 처리해서 **운영할 서버가 늘지 않아요**
- 금액은 `bigint`(원 단위 정수), 비율은 `numeric`, 시각은 `timestamptz`
- TypeORM은 하네스 기본값이라 마이그레이션·테스트 구성을 그대로 써요

## 감수한 것

- TypeORM은 `bigint`를 **문자열로** 돌려줘요. 금액 변환 규칙을 한 곳에 모아야 해요
- LISTEN/NOTIFY·어드바이저리 락 같은 Postgres 고유 기능은 ORM 밖에서 SQL로 직접 다뤄요
- `jsonb`는 DB가 모양을 검사하지 않아요. 저장 전에 코드에서 검증해요

## 다시 검토할 때

- 복잡한 성과 집계 쿼리가 많아지면: 그 부분만 쿼리 빌더나 SQL 뷰로
- 기록량이 크게 늘면: 파티셔닝이나 오래된 `skip` 판단 보관 정책

## 더 알아보기

- [PostgreSQL 문서](https://www.postgresql.org/docs/current/) — Explicit Locking(Advisory Locks), Partial Indexes, JSON Types
- [TypeORM](https://typeorm.io/) · [NestJS: Database](https://docs.nestjs.com/techniques/database)
- [Prisma](https://www.prisma.io/docs) · [Drizzle](https://orm.drizzle.team/) · [Kysely](https://kysely.dev/)
