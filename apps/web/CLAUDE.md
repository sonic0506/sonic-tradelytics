# 프로젝트 규칙

@.sonic-harness/harness.md
<!-- npm workspaces라 sonic-ui는 저장소 루트 node_modules에 설치돼요. -->

@../../node_modules/@xonic0506/sonic-ui/DESIGN.md
@../../node_modules/@xonic0506/sonic-ui/AI-RULES.md

## 이 프로젝트

- sonic-tradelytics의 웹 화면이에요(F1 봇 설정, F2 실적, F3 근거 리포트, F4 직접 거래). 기획은 저장소 루트 `docs/product/`에 있어요.
- 데이터는 `apps/server`의 api 진입점에서만 받아요. 토스 API를 직접 부르지 않아요.
- 화면은 로드맵 M4에서 만들어요. 지금 `src/pages/home`은 빌드 확인용 자리예요.
- 모노레포(`apps/server`, `apps/web`, npm workspaces)예요. husky·commitlint·CI는 저장소 루트에 있어요.

## 손익 색 (DESIGN.md 예외)

손익(금액, 수익률, 일별 손익 막대, 스파크라인)의 색은 프로젝트 전용 토큰 `pnl/*`만 써요. 증권 도메인 규칙이라 sonic-ui에 넣지 않고 이 프로젝트에만 둬요.

| 토큰       | 뜻             | 값 (sonic 토큰의 별칭)                                 |
| ---------- | -------------- | ------------------------------------------------------ |
| `pnl/up`   | 상승, `+`      | `color/text/danger`                                    |
| `pnl/down` | 하락, `−`      | `color/bg/primary` (Light cobalt/600, Dark cobalt/400) |
| `pnl/flat` | 변화 없음, `0` | `color/text/muted`                                     |

- 부호(`+`/`−`)는 항상 붙여요. 색만으로 상승·하락을 구분하지 않아요. 0은 부호 없이 써요.
- 새 색 값을 만들지 않고 sonic 토큰을 가리키기만 해요. 손익이 아닌 곳(에러 문구, 버튼)은 지금처럼 sonic 토큰을 써요.
- 하락의 코발트는 DESIGN.md의 "코발트는 행동 유도에만" 원칙의 예외예요. 손익 숫자 말고는 코발트를 늘리지 않아요.
- Figma: 파일 안 `Tradelytics` 변수 묶음의 `pnl/up`·`pnl/down`·`pnl/flat`이에요.
- 코드: 화면을 만들 때 `--app-pnl-up`·`--app-pnl-down`·`--app-pnl-flat` CSS 변수로 같은 별칭을 만들어요(`var(--sn-color-…)` 참조).

@AGENTS.md
