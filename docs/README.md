# sonic-tradelytics 문서

토스증권 오픈API 기반 1인용 주식 단타 자동매매 서비스의 기획·설계 문서예요.
원본은 `주식 단타 봇 서비스 기획 초안.md`(2026-10-20, @소닉)이고, 이 폴더가 그 내용을 역할별로 나눈 단일 출처예요.

## 문서 지도

| 폴더 | 답하는 질문 | 문서 |
| --- | --- | --- |
| [product/](./product/) | 무엇을, 왜 만드나 | [PRD](./product/prd.md), 기능 명세 [F1 봇 설정](./product/features/f1-bot-setup.md) · [F2 실적](./product/features/f2-performance.md) · [F3 근거 리포트](./product/features/f3-rationale-report.md) · [F4 직접 거래 추적](./product/features/f4-manual-trades.md) |
| [policy/](./policy/) | 코드가 반드시 지켜야 할 도메인 규칙은 | [자금 배분](./policy/fund-allocation.md) · [리스크 관리](./policy/risk-management.md) · [포지션 재평가](./policy/position-reevaluation.md) |
| [architecture/](./architecture/) | 어떻게 만드나 | [시스템 개요](./architecture/overview.md) · [데이터 모델](./architecture/data-model.md) · [주문 흐름](./architecture/order-lifecycle.md) · [엔진 설계](./architecture/engine.md) · [API 명세](./architecture/api.md) · [ADR](./architecture/adr/) |
| [integrations/](./integrations/) | 외부 시스템은 어떻게 쓰나 | [토스증권 오픈API](./integrations/toss-securities-api.md) · [DART Open API](./integrations/dart-open-api.md) |
| [project/](./project/) | 언제 하고, 무엇이 불확실한가 | [로드맵](./project/roadmap.md) · [미결정 사항](./project/open-questions.md) · [리스크](./project/risks.md) · [용어집](./project/glossary.md) |
| [learning/](./learning/) | 왜 이 기술을 골랐나 | [기술 선택 학습 자료](./learning/README.md) (주제 13개, 대안과 트레이드오프) |

## 읽는 순서

처음 보는 사람: PRD → 용어집 → 기능 명세(F1~F4) → 정책 → 시스템 개요 → 로드맵

구현하는 사람: [기술 선택 학습 자료](./learning/README.md) → 해당 기능 명세 → 관련 정책 → 데이터 모델 → 관련 ADR

## 작성 규칙

1. **한 사실은 한 문서에만** 써요. 다른 문서는 링크로 가리켜요. 예) 손실 중지 % 표는 [리스크 관리](./policy/risk-management.md)에만 있어요.
2. **정해지지 않은 것**은 본문에 단정해서 쓰지 않아요. [미결정 사항](./project/open-questions.md)에 `Q-번호`로 올리고 본문에는 `(Q-004)`처럼 참조만 남겨요. 결정되면 본문에 반영하고 Q는 "확정"으로 닫아요.
3. **기술 결정**은 [ADR](./architecture/adr/)로 남겨요. 승인된 ADR은 고치지 않고, 바꿀 때는 새 ADR을 쓰고 이전 것을 "대체됨"으로 표시해요.
4. **ID로 추적**해요. 코드·테스트·커밋에서 이 ID를 그대로 써요.

   | 종류 | 형식 | 예 |
   | --- | --- | --- |
   | 기능 요구사항 | `FR-<영역>-<번호>` | `FR-BOT-03` |
   | 비기능 요구사항 | `NFR-<번호>` | `NFR-02` |
   | 정책 | `POL-<영역>-<번호>` | `POL-FUND-05` |
   | 미결정 사항 | `Q-<번호>` | `Q-004` |
   | 리스크 | `R-<번호>` | `R-002` |
   | ADR | `ADR-<4자리>` | `ADR-0003` |

5. **우선순위**는 MoSCoW(Must / Should / Could / Won't)로 표기해요. Must는 MVP에 꼭 들어가는 것이에요.
6. 모든 문서 머리에 `상태 · 담당 · 최종 수정`을 적어요. 상태는 `초안 → 검토 중 → 확정` 순서로 바뀌어요.

## 문서 상태

| 문서 | 상태 |
| --- | --- |
| PRD, 기능 명세 F1~F4 | 초안 |
| 정책 3종 | 초안 (미결정 사항 모두 반영) |
| 아키텍처, ADR | 초안 / ADR은 제안 |
| 토스 API 연동 | 확인됨 (공식 문서 기준, 실제 호출 확인 남음) |
| 로드맵, 리스크, 용어집 | 초안 |
