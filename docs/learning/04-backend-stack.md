# 04. 서버 스택: NestJS(TypeScript) vs Python vs 서버리스, 그리고 도구

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27 · 상위: [기술 선택 학습 자료](./README.md)
> 관련 결정: [ADR-0001](../architecture/adr/0001-tech-stack.md)

## 한 줄 요약

서버는 **NestJS + TypeScript**, 테스트는 **Vitest**, 저장소는 **npm workspaces 모노레포**예요. 가장 큰 이유는 이미 있는 하네스(`sonic-harness-be/fe`)를 그대로 쓰기 위해서예요.

## 먼저 알아둘 용어

| 용어 | 무엇인가 |
| --- | --- |
| Node.js | 브라우저 밖에서 JavaScript를 실행하는 런타임. 한 스레드에서 이벤트 루프로 많은 I/O를 동시에 처리해요 |
| TypeScript | JavaScript에 타입을 더한 언어. 컴파일 시점에 실수를 잡아요 |
| NestJS | Node.js 서버 프레임워크. 모듈, 의존성 주입(DI), 데코레이터로 구조를 강제해요. Express나 Fastify 위에서 동작해요 |
| Express | Node.js의 가벼운 웹 프레임워크. 구조를 거의 강제하지 않아요 |
| 의존성 주입 (DI) | 객체가 필요한 것을 직접 만들지 않고 밖에서 받는 방식. 실전용 TossBroker와 점검용 PaperBroker를 설정만으로 바꿔 끼울 수 있어요 |
| FastAPI | Python 웹 프레임워크. pandas 같은 데이터 분석 도구와 같이 쓰기 좋아요 |
| 서버리스 | 요청이 올 때만 함수가 실행되는 방식(AWS Lambda 등). 서버 관리가 없지만 오래 떠 있는 작업에 안 맞아요 |
| 하네스 | 코드 규칙·린트·테스트 구성을 도구로 강제하는 개인 템플릿 (`sonic-harness-be`, `sonic-harness-fe`) |
| Vitest / Jest | JavaScript 테스트 도구. Vitest는 Vite 기반으로 빠르고 ESM을 기본 지원하며, Jest와 거의 같은 API를 써요 |
| 모노레포 | 여러 앱(서버, 웹)을 한 저장소에 두는 방식 |
| npm / pnpm workspaces, Turborepo | 모노레포 안의 패키지들을 묶어 관리하는 도구. Turborepo·Nx는 빌드 캐시와 작업 순서까지 관리해요 |

## 우리가 풀어야 하는 문제

- 장중에 **계속 떠 있는** 매매 루프와 웹소켓 연결이 필요해요
- 토스 API는 **고정 IP**에서만 호출돼요
- 돈과 안전장치 로직이라 **타입 안정성과 테스트**가 중요해요
- 1인 개발이라 초기 설정 비용을 줄여야 해요

## 선택지 비교

**언어·프레임워크**

| 선택지 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **NestJS + TypeScript** | 하네스 그대로 사용, 서버·웹 타입 공유, DI로 Broker 교체 쉬움 | 수치 분석 도구가 Python보다 적음 | 채택 |
| Express + TypeScript | 가볍고 자유로움 | 구조를 직접 정해야 함, 하네스와 안 맞음 | 1인 개발에서 규칙이 흐트러지기 쉬움 |
| Python FastAPI + pandas | 지표·백테스트·통계 도구가 풍부 | 하네스 못 씀, 웹과 언어가 갈림 | 분석 편의보다 안전 로직의 일관성을 택함 |

**실행 방식**

| 선택지 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **상주 서버 (VM)** | 웹소켓·루프를 계속 유지, 고정 IP | 서버를 직접 관리 | 채택 ([10](./10-deploy-and-access.md)) |
| 서버리스 | 관리 없음, 쓴 만큼 과금 | 실행 시간 제한, 상주 연결 불가, IP 고정이 번거로움 | 장중 상주 루프와 맞지 않아요 |

**도구**

| 항목 | 선택 | 대안과 차이 |
| --- | --- | --- |
| 테스트 | Vitest | Jest: 생태계가 더 크지만 ESM·TypeScript 설정이 번거로움. 하네스가 Vitest로 정해져 있어요 |
| 모노레포 | npm workspaces | pnpm: 설치가 빠르고 디스크를 아낌. Turborepo·Nx: 빌드 캐시. 앱이 2개라 npm 기본 기능으로 충분 |

## 선택과 이유

이미 검증한 규칙·CI·테스트 구성을 그대로 쓰면, 1인 개발에서 가장 비싼 "처음 세팅하고 규칙 지키기" 비용이 줄어요. 서버와 웹이 같은 TypeScript라 API 타입을 공유할 수 있어요.

## 감수한 것

- **백테스트·통계 도구가 부족해요.** 필요해지면 백테스트만 Python으로 따로 검토해요
- Node는 한 스레드라 **무거운 계산이 시세 수신과 봇 루프를 막을 수 있어요.** 무거운 일은 장후 배치나 별도 프로세스로 빼요
- NestJS의 데코레이터·DI는 처음엔 배우는 양이 있어요

## 다시 검토할 때

- 백테스트(M7)를 만들 때: Python 별도 서비스 vs TypeScript 그대로
- 앱·패키지가 늘어 빌드가 느려질 때: pnpm, Turborepo

## 더 알아보기

- [NestJS 문서](https://docs.nestjs.com/) — Modules, Providers(DI), Lifecycle events
- [Vitest](https://vitest.dev/) · [Jest](https://jestjs.io/)
- [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) · [pnpm workspaces](https://pnpm.io/workspaces) · [Turborepo](https://turborepo.com/docs)
