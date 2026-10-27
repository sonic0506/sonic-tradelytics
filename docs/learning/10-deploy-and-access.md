# 10. 배포와 접근 제어: VM + Docker Compose, Tailscale

> 상태: 초안 · 담당: @소닉 · 최종 수정: 2026-10-27 · 상위: [기술 선택 학습 자료](./README.md)
> 관련 결정: [ADR-0006](../architecture/adr/0006-network-level-access-control.md) · [ADR-0001](../architecture/adr/0001-tech-stack.md) · [시스템 개요 배포](../architecture/overview.md#배포) · R-003, R-004

## 한 줄 요약

고정 IP VM 1대에 Docker Compose로 4개 컨테이너를 띄우고, 관리 화면은 앱 로그인 대신 **Tailscale 사설망 안에서만** 열어요.

## 먼저 알아둘 용어

| 용어 | 무엇인가 |
| --- | --- |
| VM | 클라우드에서 빌리는 가상 서버. 고정(정적) 공인 IP를 붙일 수 있어요 |
| Docker / 컨테이너 | 앱과 실행 환경을 묶어 어디서나 같게 실행하는 방식 |
| Docker Compose | 여러 컨테이너(api, engine, web, postgres)를 파일 하나로 정의하고 함께 띄우는 도구 |
| Kubernetes | 여러 서버에 컨테이너를 배치·확장·복구하는 오케스트레이션 시스템 |
| PaaS | 코드만 올리면 실행해 주는 서비스 (Render, Fly.io, Railway 등) |
| VPN / Tailscale | VPN은 사설망을 만드는 기술. Tailscale은 WireGuard 기반으로 내 기기들을 설정 없이 하나의 사설망으로 묶어줘요 |
| Zero Trust 프록시 (Cloudflare Access) | 앱 앞에서 로그인을 대신 확인해 주는 관문. 앱은 공개 주소를 갖지만 인증된 사람만 통과 |

## 우리가 풀어야 하는 문제

- 토스 API는 **등록한 고정 IP**에서만 호출돼요
- 관리 화면에서 **실제 주문**을 일으킬 수 있어 외부 노출은 치명적이에요
- 장중에 **휴대폰에서** 킬 스위치를 눌러야 해요
- 1인 운영이라 인프라는 단순해야 해요

## 선택지 비교

**배포 방식**

| 방식 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| **VM 1대 + Docker Compose** | 고정 IP, 단순, 비용 낮음 | 서버 장애 시 전체 중단, 직접 관리 | 채택 |
| Kubernetes | 자동 복구·확장 | 학습·운영 부담이 큼 | 1인·서버 1대에 과해요 |
| PaaS | 서버 관리 없음 | 고정 출구 IP가 유료이거나 제한, 상주 프로세스 제약 | 토스 IP 등록과 맞추기 번거로움 |
| 서버리스 | 관리 없음 | 상주 웹소켓 불가 | 불가 ([04](./04-backend-stack.md)) |

**접근 제어**

| 방식 | 장점 | 단점 | 우리 상황 |
| --- | --- | --- | --- |
| 앱 로그인 (비밀번호 + 2FA) | 어디서나 브라우저로 접속 | 인증 코드를 만들고 지켜야 함, 실수하면 그대로 노출 | 1인용에 비해 위험·부담 |
| **Tailscale 사설망** | 공인 인터넷에 안 열림, 인증 코드 없음, 휴대폰 앱으로 접속 | 기기마다 Tailscale 설치, 남에게 보여주기 어려움 | 채택 |
| Cloudflare Access | 브라우저만으로 접속, 강한 인증 | 도메인을 Cloudflare에 연결해야 함 | 공개가 필요해지면 검토 |

## 선택과 이유

- 고정 IP가 필요하고 상주 프로세스가 있어서 VM이 가장 단순해요
- 방화벽은 SSH와 Tailscale만 열어요. 웹·API 포트는 외부에서 보이지 않아요
- 인증을 앱이 아니라 네트워크가 하니, 만들 코드와 실수할 곳이 줄어요

## 감수한 것

- 서버 1대라 그 서버가 죽으면 매매가 멈춰요. 그래서 손절은 증권사 조건주문에 맡겨요 ([08](./08-order-safety.md))
- 백업·OS 업데이트·디스크 관리는 직접 해요
- 다른 사람에게 화면을 보여주려면 별도 방법이 필요해요

## 다시 검토할 때

- 다른 사람이 써야 하면: Cloudflare Access나 앱 로그인
- 가용성이 더 필요하면: 예비 서버와 engine 단일 실행 잠금으로 수동 전환

## 더 알아보기

- [Docker Compose](https://docs.docker.com/compose/)
- [Tailscale: How it works](https://tailscale.com/blog/how-tailscale-works)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
