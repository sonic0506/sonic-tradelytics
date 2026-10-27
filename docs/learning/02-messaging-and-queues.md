# 02. 프로세스 간 명령 전달: Postgres LISTEN/NOTIFY vs Redis vs BullMQ

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27 · 상위: [기술 선택 학습 자료](./README.md)
> 관련 결정: [ADR-0004](../architecture/adr/0004-postgres-notify-for-commands.md) · [ADR-0002](../architecture/adr/0002-split-api-and-engine.md) · NFR-02

## 한 줄 요약

화면에서 누른 정지·청산·킬 스위치는 `command` 테이블에 저장하고 Postgres `NOTIFY`로 engine을 깨워요. Redis나 메시지 큐는 쓰지 않아요.

## 먼저 알아둘 용어

| 용어 | 무엇인가 |
| --- | --- |
| Redis | 메모리에 데이터를 두는 아주 빠른 키-값 저장소. 캐시, 세션, 카운터, 잠금, 메시지 전달에 두루 쓰여요. 별도 서버로 띄워야 해요 |
| Redis Pub/Sub | Redis의 발행·구독 기능. 채널에 보낸 메시지를 그 순간 구독 중인 쪽만 받아요. **저장하지 않아서** 구독자가 없거나 끊겨 있으면 메시지가 사라져요 |
| Redis Streams | 메시지를 로그처럼 저장하는 Redis 기능. 끊겼다가 다시 와도 이어 읽을 수 있어요 |
| BullMQ | Redis 위에서 동작하는 Node.js **작업 큐** 라이브러리. "이 작업을 해줘"를 큐에 넣으면 워커가 꺼내 처리해요. 재시도, 지연 실행, 반복 실행, 동시 처리 수 제한을 기본 제공해요. NestJS용 모듈(`@nestjs/bullmq`)이 있어요 |
| 메시지 브로커 (RabbitMQ, Kafka) | 메시지를 전문으로 저장·전달하는 서버. RabbitMQ는 작업 분배, Kafka는 대용량 이벤트 로그에 강해요 |
| Postgres LISTEN/NOTIFY | Postgres에 내장된 가벼운 알림 기능. `NOTIFY 채널`을 보내면 `LISTEN 채널` 중인 연결이 즉시 받아요. Redis Pub/Sub처럼 **저장하지 않아요** |
| pg-boss | Postgres 테이블을 큐로 쓰는 Node.js 작업 큐 라이브러리. Redis 없이 BullMQ 비슷한 기능을 줘요 |
| 메시지와 작업의 차이 | 메시지(알림)는 "이런 일이 생겼어", 작업(job)은 "이걸 처리해줘 + 결과·재시도 관리" |

## 우리가 풀어야 하는 문제

- 킬 스위치를 누르면 **1초 안에** 신규 주문이 멈춰야 해요 (NFR-02)
- 명령을 **잃어버리면 안 돼요.** engine이 재시작 중이어도 다시 떠서 처리해야 해요
- 명령 이력이 **감사 기록**으로 남아야 해요
- 명령 수는 하루 몇 건 수준이에요. 처리량은 중요하지 않아요
- 1인 운영이라 띄우고 관리할 서버는 적을수록 좋아요

## 선택지 비교

| 방식 | 속도 | 유실 | 기록 | 운영 부담 | 우리 상황 |
| --- | --- | --- | --- | --- | --- |
| engine이 DB를 1초마다 폴링 | 최대 1초 | 없음 | 테이블에 남음 | 없음 | 가능하지만 1초 경계에 걸리고, 쿼리가 계속 돌아요 |
| engine이 api를 HTTP 폴링 | 최대 주기 | 없음 | 따로 만들어야 | 없음 | 1초를 맞추려면 호출이 많아져요 |
| Redis Pub/Sub | 즉시 | **있음** (끊긴 동안) | 없음 | Redis 서버 추가 | 유실 보완을 위해 결국 테이블이 또 필요해요 |
| BullMQ | 즉시 | 없음 (Redis에 저장) | 작업 이력 | Redis 서버 추가 + 큐 운영 지식 | 재시도·지연 실행은 좋지만, 명령 몇 건에는 과해요 |
| RabbitMQ / Kafka | 즉시 | 없음 | 있음 | 브로커 서버 운영 | 1인 서비스에 비해 너무 커요 |
| **테이블 + LISTEN/NOTIFY** | 즉시 | 알림은 유실 가능, **테이블 재조회로 보완** | 테이블이 곧 기록 | 이미 있는 Postgres | 요구사항을 모두 만족 |

## 선택과 이유

1. api가 `command` 행 삽입 + `NOTIFY command`를 **같은 트랜잭션**에서 실행해요 (커밋돼야 알림이 가요)
2. engine은 `LISTEN command`로 즉시 받아 처리하고 `handled_at`을 채워요
3. engine은 시작할 때와 주기적으로 `handled_at is null`인 명령을 다시 읽어요 (놓친 알림 보완)

이미 있는 Postgres만으로 "즉시 + 유실 없음 + 기록"을 모두 얻어요. 서버가 하나도 늘지 않아요.

## 감수한 것

- NOTIFY는 저장되지 않아서 **재조회 로직을 직접** 만들어야 해요
- LISTEN 연결 하나를 커넥션 풀과 별도로 계속 유지해야 해요
- 알림 내용(payload)은 기본 8000바이트 제한이 있어요. 그래서 알림에는 id만 넣고 내용은 테이블에서 읽어요
- BullMQ가 주는 재시도·지연 실행·대시보드가 없어요. 필요한 만큼 직접 만들어요

## 다시 검토할 때

- 명령 말고 **무거운 작업**(백테스트, 대량 집계)을 나눠 처리해야 할 때: pg-boss(Postgres 유지) → BullMQ(Redis 추가) 순으로 검토
- engine을 여러 대로 늘려야 할 때: 작업 분배가 필요해져 큐가 맞아요
- 캐시가 정말 필요해질 때: 그때 Redis를 들이면 BullMQ도 같이 쓸 수 있어요

## 더 알아보기

- [PostgreSQL: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html) · [LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)
- [Redis Pub/Sub](https://redis.io/docs/latest/develop/interact/pubsub/) · [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [BullMQ 문서](https://docs.bullmq.io/) · [NestJS: Queues](https://docs.nestjs.com/techniques/queues)
- [pg-boss](https://github.com/timgit/pg-boss)
