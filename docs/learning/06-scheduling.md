# 06. 배치 스케줄링: @nestjs/schedule vs OS cron vs BullMQ 반복 작업

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27 · 상위: [기술 선택 학습 자료](./README.md)
> 관련 결정: [ADR-0001](../architecture/adr/0001-tech-stack.md) · [시스템 개요 일일 일정](../architecture/overview.md#일일-일정-engine) · [포지션 재평가](../policy/position-reevaluation.md)

## 한 줄 요약

장전 점검(08:30), 장후 재평가(15:40) 같은 배치는 engine 안에서 `@nestjs/schedule`로 돌려요. 휴장일 판단은 스케줄러가 아니라 장 캘린더로 해요.

## 먼저 알아둘 용어

| 용어 | 무엇인가 |
| --- | --- |
| cron 표현식 | "매일 8시 30분" 같은 주기를 `0 30 8 * * *` 같은 문자열로 적는 형식 |
| OS cron | 서버 운영체제가 정해진 시각에 명령을 실행해 주는 기능 |
| `@nestjs/schedule` | NestJS 앱 **안에서** 크론·인터벌·타임아웃 작업을 돌리는 모듈. 앱이 떠 있어야 동작해요 |
| BullMQ 반복 작업 | Redis에 "매일 8:30 실행" 작업을 저장해 두고 워커가 처리. 여러 서버 중 하나만 실행, 실패 재시도를 지원 |
| 외부 스케줄러 | 클라우드의 예약 실행 서비스(예: GitHub Actions schedule, 클라우드 스케줄러)가 정해진 시각에 내 서버를 호출 |
| 누락 실행 (misfire) | 서버가 꺼져 있어 정해진 시각을 놓친 실행. 어떤 도구는 다시 실행해 주고, 어떤 도구는 그냥 넘어가요 |

## 우리가 풀어야 하는 문제

- 하루 몇 번, 정해진 한국 시각에 배치가 돌아야 해요
- **휴장일·개장 지연**을 따라야 해요
- 배치는 토스 API를 부르므로 **engine 안에서**, TossClient의 한도 관리를 함께 받아야 해요
- 배치가 실패하면 해당 봇의 신규 진입을 멈추고 알려야 해요 (POL-RISK-11)

## 선택지 비교

| 방식 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **@nestjs/schedule (engine 안)** | 설정이 가장 단순, TossClient·DB 연결을 그대로 사용 | 실행 이력·재시도·누락 보정이 없음, 인스턴스가 여러 개면 중복 실행 | engine이 하나뿐이라 중복 걱정 없음 |
| OS cron이 스크립트 실행 | 앱과 독립 | 스크립트가 토큰을 따로 발급하면 engine 토큰을 끊음 (토큰 1개 제한) | 맞지 않아요 |
| BullMQ 반복 작업 | 이력·재시도·분산 실행 | Redis 필요 ([02](./02-messaging-and-queues.md)) | 지금 규모에 과해요 |
| 외부 스케줄러가 HTTP 호출 | 서버 밖에서 시간 관리 | 서버를 외부에 열어야 함 (ADR-0006과 충돌) | 맞지 않아요 |

## 선택과 이유

- engine 하나 안에서 돌리면 토큰·호출 한도·DB 연결을 공유하고 중복 실행 문제가 없어요
- 크론 시각은 `Asia/Seoul`로 명시하고, 실행 직후 **장 캘린더**로 오늘이 거래일인지 확인해요
- 실행 결과는 DB에 남겨(`risk_events` 등) 이력과 실패 알림을 직접 처리해요

## 감수한 것

- **누락 보정이 없어요.** engine이 08:30에 꺼져 있었다면 다시 떴을 때 "오늘 장전 점검을 했나"를 직접 확인해서 실행해야 해요
- 재시도·실행 이력을 직접 만들어요
- 배치와 매매 루프가 같은 프로세스라, 오래 걸리는 배치가 루프를 밀 수 있어요

## 다시 검토할 때

- Redis를 들이게 되면: 반복 작업을 BullMQ로 옮겨 이력·재시도를 얻을 수 있어요
- 배치가 무거워지면: 별도 워커 프로세스로 분리

## 더 알아보기

- [NestJS: Task Scheduling](https://docs.nestjs.com/techniques/task-scheduling) — `timeZone` 옵션
- [BullMQ: Job Schedulers](https://docs.bullmq.io/guide/job-schedulers)
- [crontab.guru](https://crontab.guru/) — cron 표현식 확인 (Nest는 초 단위 6자리 표현식도 지원)
