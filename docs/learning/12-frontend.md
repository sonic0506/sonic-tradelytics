# 12. 웹 화면: Next.js + FSD, 화면 실시간 갱신 방식

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27 · 상위: [기술 선택 학습 자료](./README.md)
> 관련 결정: [ADR-0001](../architecture/adr/0001-tech-stack.md) · [F2 실적](../product/features/f2-performance.md) · FR-PERF-06

## 한 줄 요약

웹은 하네스(`sonic-harness-fe`)에 맞춰 **Next.js + FSD**로 만들어요. 화면 실시간 갱신 방식은 아직 정하지 않았고, 아래 비교로 고르면 돼요.

## 먼저 알아둘 용어

| 용어 | 무엇인가 |
| --- | --- |
| SPA | 브라우저에서 JS가 화면을 모두 그리는 앱. Vite + React가 대표적 |
| Next.js | React 프레임워크. 라우팅, 서버 렌더링, 서버 컴포넌트를 제공 |
| 서버 컴포넌트 | 서버에서 데이터를 읽어 HTML로 그려 보내는 React 컴포넌트. 클라이언트 JS가 줄어요 |
| FSD (Feature-Sliced Design) | 프론트엔드 코드를 app·pages·widgets·features·entities·shared 레이어로 나누는 구조 규칙 |
| 데이터 갱신 도구 | TanStack Query 같은 라이브러리. 주기적 재조회, 캐시, 로딩 상태를 관리 |

## 우리가 풀어야 하는 문제

- 장중엔 휴대폰으로 상태 확인·긴급 정지, 장후엔 PC로 실적·근거 분석
- 보유 포지션 평가 손익을 실시간 갱신해야 해요 (Should)
- 사용자 1명, 사설망 안에서만 접속

## 선택지 비교

**프레임워크**

| 방식 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **Next.js** | 하네스 기본값, 라우팅·서버 렌더링 내장 | 서버 컴포넌트 등 배울 개념이 많음 | 채택 |
| Vite + React SPA | 단순, 빌드 빠름 | 하네스와 다름 | 1인용 관리 화면이면 충분하긴 해요 |

**화면 실시간 갱신** (정하지 않음)

| 방식 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| 주기적 폴링 (예: 3~5초) | 가장 단순, 서버 변경 거의 없음 | 약간 늦고 요청이 계속 감 | 사용자 1명이라 부하 문제 없음. **권장 시작점** |
| SSE | 서버가 바뀔 때만 보냄, 브라우저 자동 재연결 | api가 engine 변경을 알아야 함 (NOTIFY 연계) | 지연이 문제 될 때 다음 단계 |
| 웹소켓 | 양방향 | 화면에서 보낼 실시간 데이터가 없어 과함 | 필요 없음 |

## 선택과 이유

- 하네스의 규칙·구성을 그대로 써서 설정 비용을 줄여요
- 서버와 같은 TypeScript라 DTO 타입을 공유해요
- 화면 데이터는 engine이 DB에 쓴 값이라 원래 몇 초 늦어요. 폴링으로 시작해도 체감 차이가 작아요

## 감수한 것

- Next.js의 서버·클라이언트 경계는 배울 것이 있어요
- 폴링은 기준 시각을 함께 보여줘야 사용자가 "몇 초 전 값"인지 알아요

## 더 알아보기

- [Next.js 문서](https://nextjs.org/docs) · [Feature-Sliced Design](https://feature-sliced.design/)
- [TanStack Query](https://tanstack.com/query/latest) · [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
