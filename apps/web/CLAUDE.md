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

@AGENTS.md
