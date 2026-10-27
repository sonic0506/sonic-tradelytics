# DART Open API 연동

> 상태: 초안 (공식 개발가이드 기준, 2026-10-26) · 담당: @소닉 · 최종 수정: 2026-10-26
> 관련: [재평가 정책](../policy/position-reevaluation.md) · [ADR-0008](../architecture/adr/0008-external-data-numeric-only.md) · [토스 API 연동](./toss-securities-api.md)

금융감독원 전자공시(DART)의 공시 목록을 받아, 이월 봇 장전 점검의 **공시 경계** 신호로 써요([POL-REEV-06](../policy/position-reevaluation.md#장전-점검과-개장-직후-점검-pol-reev-06)). 공시 내용은 해석하지 않고 "있음 / 유형 코드"만 써요.

## 공식 문서

| 문서 | 용도 |
| --- | --- |
| [OPENDART 공시검색 개발가이드](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001) | 공시 목록 조회 API 스펙 |
| [OPENDART](https://opendart.fss.or.kr/) | 인증키 발급 |

## 사용할 API

`GET https://opendart.fss.or.kr/api/list.json` (공시검색)

| 요청 인자 | 사용 값 |
| --- | --- |
| `crtfc_key` | 발급받은 인증키(40자). 환경변수로 주입 |
| `bgn_de`, `end_de` | 전 거래일 ~ 오늘 (YYYYMMDD) |
| `pblntf_ty` | `B`(주요사항보고), `I`(거래소공시)를 각각 조회 |
| `corp_cls` | `Y`(유가증권), `K`(코스닥) |
| `page_count` | 100 (최대). `total_page`만큼 넘겨요 |

| 응답 필드 | 사용 |
| --- | --- |
| `stock_code` | 보유 종목과 대조 (6자리 종목코드) |
| `rcept_no` | 공시 식별자(14자리). 근거 카드에 기록하고 원문 링크(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=...`)를 만들어요 |
| `rcept_dt` | 접수일 |
| `report_nm` | 보고서명. 화면 표시용으로만 저장하고 판단에는 쓰지 않아요 |

- `corp_code` 없이 조회하면 검색 기간이 3개월로 제한돼요. 우리는 하루치만 보므로 문제없어요
- 응답의 `rcept_dt`는 날짜만 있어요. 그래서 "전 거래일 15:30 이후"를 정확히 거를 수 없어, **전 거래일과 당일 접수분 전체**를 대상으로 해요(보수적으로 더 넓게 봄)

## 한도와 오류

| 항목 | 내용 |
| --- | --- |
| 요청 한도 | 일반적으로 하루 20,000건 이상이면 `020` 오류. 우리 사용량(하루 수십 건)은 충분히 작아요 |
| 주요 상태 코드 | `000` 정상, `013` 조회된 데이터 없음(정상 처리), `010`·`011` 키 문제, `012` 접근할 수 없는 IP, `020` 한도 초과, `800` 점검 중 |
| 실패 시 | 데이터를 못 받으면 공시 경계가 있는 것으로 보고 알려요 ([POL-REEV-07](../policy/position-reevaluation.md#정책)) |

## 사용 원칙

| 원칙 | 내용 |
| --- | --- |
| 호출 지점 | engine의 `DartClient`만 호출해요 |
| 비밀값 | `crtfc_key`는 환경변수, 저장소 금지 ([NFR-06](../product/prd.md#7-비기능-요구사항)) |
| 저장 | 조회한 공시는 `disclosure` 테이블에 저장해 근거 카드에서 다시 볼 수 있게 해요 ([데이터 모델](../architecture/data-model.md)) |
| 판단 | 유형 코드와 개수만 판단에 써요. 보고서명·본문은 판단에 쓰지 않아요 ([ADR-0008](../architecture/adr/0008-external-data-numeric-only.md)) |

## 남은 확인

- [ ] 인증키 발급 후 `list.json` 호출 1회 성공
- [ ] 키에 IP 제한이 걸리는지(`012` 코드 존재), 걸린다면 운영 서버 IP 등록
- [ ] 거래소공시(`I`)에 관리종목 지정 공시가 포함되는지 확인. 포함되면 [Q-012](../project/open-questions.md#q-012)의 관리종목 수집(백로그)을 이 연동으로 해결
