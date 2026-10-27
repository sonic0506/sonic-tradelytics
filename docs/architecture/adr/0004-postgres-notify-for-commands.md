# ADR-0004. 프로세스 간 명령은 Postgres LISTEN/NOTIFY로 전달

- 상태: 제안
- 날짜: 2026-10-26

## 맥락

화면에서 누른 봇 정지·전량 청산·킬 스위치가 engine에 1초 안에 전달돼야 해요([NFR-02](../../product/prd.md#7-비기능-요구사항)). 명령은 잃어버리면 안 되고, 기록도 남아야 해요.

## 결정

- api는 `command` 테이블에 행을 넣고 같은 트랜잭션에서 `NOTIFY command`를 보내요
- engine은 `LISTEN command`로 즉시 받고, 시작 시와 주기적으로 미처리 명령(`handled_at is null`)을 다시 읽어 놓친 알림을 보완해요
- 처리 후 `handled_at`을 채워요

## 결과

- Redis·메시지 큐 없이 이미 있는 Postgres만으로 해결해요
- 명령 이력이 그대로 감사 기록이 돼요
- 감수: NOTIFY는 연결이 끊긴 동안의 알림을 버려요. 그래서 테이블 재조회를 함께 둬요

## 검토한 대안

- Redis Pub/Sub, BullMQ: 운영할 서버가 하나 늘어요
- engine이 api를 폴링: 1초 요구를 맞추려면 호출이 많아져요
