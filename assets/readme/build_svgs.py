"""README용 SVG 컴포넌트를 다크/라이트 두 벌로 만들어요.

실행: python3 assets/readme/build_svgs.py
GitHub 이미지 프록시가 CSS·foreignObject를 지우므로 순수 SVG + SMIL 애니메이션만 써요.
"""
from pathlib import Path

OUT = Path(__file__).parent
W = 840
SANS = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic','Segoe UI',sans-serif"
MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,monospace"

THEMES = {
    "dark": dict(bg0="#0A0E13", bg1="#101820", card="#131C25", card2="#18232E", stroke="#223140",
                 text="#E9F2F1", sub="#8B9BA7", faint="#2A3946", mint="#2EE6A6", mint2="#12B886",
                 cyan="#5EEAD4", orange="#FF8A1F", red="#FF5A5F", yellow="#FFD233", grid="0.07"),
    "light": dict(bg0="#F7FBF9", bg1="#EDF6F2", card="#FFFFFF", card2="#F4FAF7", stroke="#D3E5DC",
                  text="#0F1F28", sub="#5A6B76", faint="#E1ECE7", mint="#0FBF86", mint2="#0A9C6D",
                  cyan="#0EA5A0", orange="#F07800", red="#E5484D", yellow="#E9A800", grid="0.10"),
}


def T(x, y, s, size=13, fill="text", weight=400, anchor="start", font=SANS, extra=""):
    return (f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" font-weight="{weight}" '
            f'fill="{{{fill}}}" text-anchor="{anchor}" {extra}>{s}</text>')


def card(x, y, w, h, rx=16, fill="card", stroke="stroke"):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{{{fill}}}" '
            f'stroke="{{{stroke}}}" stroke-width="1" filter="url(#shadow)"/>')


def pill(x, y, w, s, color="mint", size=11, h=22):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{{{color}}}" fill-opacity="0.14" '
            f'stroke="{{{color}}}" stroke-opacity="0.45"/>'
            + T(x + w / 2, y + h / 2 + size * 0.36, s, size, color, 700, "middle"))


def svg(h, body, bg=True):
    defs = f'''<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{bg0}}"/><stop offset="1" stop-color="{{bg1}}"/></linearGradient>
<linearGradient id="gTitle" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0" stop-color="{{mint}}"/><stop offset="0.5" stop-color="{{cyan}}"/><stop offset="1" stop-color="{{mint}}"/>
  <animate attributeName="x1" values="-100%;0%;-100%" dur="6s" repeatCount="indefinite"/>
  <animate attributeName="x2" values="0%;100%;0%" dur="6s" repeatCount="indefinite"/>
</linearGradient>
<linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{mint}}" stop-opacity="0.35"/><stop offset="1" stop-color="{{mint}}" stop-opacity="0"/></linearGradient>
<linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{mint}}" stop-opacity="0"/><stop offset="0.5" stop-color="{{mint}}"/><stop offset="1" stop-color="{{orange}}" stop-opacity="0"/></linearGradient>
<pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="{{mint}}" stroke-opacity="{{grid}}"/></pattern>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="36"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.12"/></filter>
<clipPath id="frame"><rect width="{W}" height="{h}" rx="20"/></clipPath>
</defs>'''
    back = (f'<g clip-path="url(#frame)"><rect width="{W}" height="{h}" fill="url(#bg)"/>'
            f'<rect width="{W}" height="{h}" fill="url(#grid)"/></g>') if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{h}" viewBox="0 0 {W} {h}">'
            f'{defs}{back}{body}</svg>')


# ---------------------------------------------------------------- 컴포넌트

def banner():
    h = 230
    tape = ("▲ 근거 기록 커버리지 100%      ■ 킬 스위치 1초 안에 신규 주문 정지      ▲ 상한 해제: 10거래일 · 30건 · 손익비 1.5 이상"
            "      ▼ 불확실하면 멈춤      ■ 기록은 추가만, 수정·삭제 없음      ")
    period = 1010  # 브라우저에서 잰 테이프 글자 폭(약 1003px). 문구를 바꾸면 다시 재요
    tape_attr = f'textLength="{period}" lengthAdjust="spacing"'
    title = T(46, 118, "sonic-tradelytics", 54, "mint", 800).replace('fill="{mint}"', 'fill="url(#gTitle)" letter-spacing="-1.5"')
    subtitle = T(48, 154, "매 거래마다 <tspan fill=\"{orange}\" font-weight=\"700\">근거 · 예측 · 결과</tspan>가 남는, 검증 가능한 단타 봇", 18, "text", 500)
    spark = "590,150 612,138 634,144 656,120 678,128 700,104 722,112 744,86 766,94 788,70 800,74"
    b = f'''
<g clip-path="url(#frame)">
  <ellipse cx="140" cy="40" rx="150" ry="120" fill="{{mint}}" opacity="0.16" filter="url(#glow)">
    <animate attributeName="cx" values="140;190;120;140" dur="9s" repeatCount="indefinite"/></ellipse>
  <ellipse cx="740" cy="170" rx="130" ry="110" fill="{{orange}}" opacity="0.13" filter="url(#glow)">
    <animate attributeName="opacity" values="0.13;0.22;0.13" dur="6s" repeatCount="indefinite"/></ellipse>
</g>
<circle cx="52" cy="50" r="4" fill="{{mint}}"><animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite"/></circle>
{T(64, 54, "LIVE · KRX 09:00–15:30 · 토스증권 오픈API", 12, "sub", 500, font=MONO)}
{title}
{subtitle}
<polygon points="{spark} 800,170 590,170" fill="url(#gArea)" opacity="0.8"/>
<polyline points="{spark}" fill="none" stroke="{{mint}}" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="320" stroke-dashoffset="320">
  <animate attributeName="stroke-dashoffset" values="320;0;0" keyTimes="0;0.6;1" dur="5s" repeatCount="indefinite"/></polyline>
<circle cx="800" cy="74" r="5" fill="{{mint}}"><animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/></circle>
<g clip-path="url(#frame)">
  <rect x="0" y="190" width="{W}" height="40" fill="{{mint}}" fill-opacity="0.08"/>
  <line x1="0" y1="190" x2="{W}" y2="190" stroke="{{mint}}" stroke-opacity="0.35"/>
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 0;-{period} 0" dur="34s" repeatCount="indefinite"/>
    {T(0, 215, tape, 13, "mint", 600, font=MONO, extra=tape_attr)}
    {T(period, 215, tape, 13, "mint", 600, font=MONO, extra=tape_attr)}
  </g>
</g>'''
    return svg(h, b)


def concept():
    h = 270
    logs = ["10:12  BUY   000000  12,350", "10:15  SELL  000000  12,430", "10:31  BUY   000000  12,520",
            "10:33  SELL  000000  12,410"]
    left = card(20, 20, 370, 230) + T(44, 56, "흔한 자동매매 봇", 15, "sub", 700)
    left += "".join(T(44, 92 + i * 24, s, 13, "sub", 500, font=MONO, extra='xml:space="preserve"') for i, s in enumerate(logs))
    left += T(44, 214, "왜 샀지? 예측은 맞았나? 규칙을 고치면 나아졌나?", 14, "red", 700)
    rows = [("근거", "거래량 3.4배 ≥ 기준 3배 · 고점 돌파", "mint"),
            ("예측", "상승 · 목표 +1% · 3분 이내", "cyan"),
            ("결과", "+0.65% · 2분 40초 · 시간 청산", "orange"),
            ("채점", "방향 적중 · 목표의 67% 도달", "mint")]
    right = card(450, 20, 370, 230, stroke="mint") + T(474, 56, "sonic-tradelytics 봇", 15, "mint", 800)
    for i, (k, v, c) in enumerate(rows):
        y = 74 + i * 40
        right += pill(474, y, 52, k, c, 12, 26) + T(540, y + 18, v, 13, "text", 500)
        right += (f'<rect x="474" y="{y}" width="52" height="26" rx="13" fill="{{{c}}}" opacity="0">'
                  f'<animate attributeName="opacity" values="0;0;0.35;0" keyTimes="0;{0.15 + i * 0.18:.2f};{0.25 + i * 0.18:.2f};1" dur="6s" repeatCount="indefinite"/></rect>')
    mid = (f'<circle cx="420" cy="135" r="20" fill="{{mint}}"/>'
           f'<path d="M412 135h14m-6-7 7 7-7 7" stroke="{{bg0}}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
           f'<circle cx="420" cy="135" r="20" fill="none" stroke="{{mint}}"><animate attributeName="r" values="20;30" dur="2s" repeatCount="indefinite"/>'
           f'<animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite"/></circle>')
    return svg(h, left + right + mid, bg=False)


def features():
    h = 560
    b = ""
    cards = [(20, 20, "F1", "봇 생성 · 설정", "유형 → 자금·기간 → 규칙 값 → 안전장치, 4단계로 끝"),
             (430, 20, "F2", "봇별 투자 실적", "수수료·세금 뺀 순손익과 위험 지표로 진짜 실력 비교"),
             (20, 260, "F3", "투자 근거 리포트", "주문 전에 근거·예측을 저장하고 청산 후 자동 채점"),
             (430, 260, "F4", "직접 거래 추적", "앱에서 직접 한 거래도 봇과 같은 기준으로 성과 비교")]
    for x, y, tag, title, desc in cards:
        b += card(x, y, 390, 224) + pill(x + 22, y + 20, 38, tag, "mint", 12, 24)
        b += T(x + 72, y + 38, title, 19, "text", 800) + T(x + 22, y + 72, desc, 13, "sub", 500)

    # F1: 4단계 진행
    x, y = 20, 20
    steps = ["① 유형", "② 자금·기간", "③ 규칙 값", "④ 안전장치"]
    xs = ";".join(str(x + 22 + i * 88) for i in range(4))
    b += (f'<rect x="{x + 22}" y="{y + 96}" width="80" height="34" rx="10" fill="{{mint}}" fill-opacity="0.22">'
          f'<animate attributeName="x" values="{xs}" dur="4s" calcMode="discrete" repeatCount="indefinite"/></rect>')
    for i, s in enumerate(steps):
        bx = x + 22 + i * 88
        b += f'<rect x="{bx}" y="{y + 96}" width="80" height="34" rx="10" fill="none" stroke="{{stroke}}"/>'
        b += T(bx + 40, y + 118, s, 12, "text", 700, "middle")
    for i, s in enumerate(["스캘핑", "데이 트레이딩", "스윙", "종가 베팅"]):
        b += pill(x + 22 + i * 88, y + 146, 80, s, "orange" if i >= 2 else "cyan", 11)
    b += T(x + 22, y + 200, "신규 봇은 소액 상한으로 시작 · 규칙 바꾸면 새 버전으로 저장", 12, "sub", 500)

    # F2: 수익 곡선 + 지표
    x, y = 430, 20
    pts = [(0, 60), (20, 54), (40, 58), (60, 44), (80, 48), (100, 34), (120, 38), (140, 24), (160, 30), (180, 14), (200, 18)]
    poly = " ".join(f"{x + 22 + px},{y + 96 + py}" for px, py in pts)
    b += f'<polygon points="{poly} {x + 222},{y + 186} {x + 22},{y + 186}" fill="url(#gArea)"/>'
    b += (f'<polyline points="{poly}" fill="none" stroke="{{mint}}" stroke-width="2.5" stroke-dasharray="260" stroke-dashoffset="260">'
          f'<animate attributeName="stroke-dashoffset" values="260;0;0" keyTimes="0;0.5;1" dur="5s" repeatCount="indefinite"/></polyline>')
    b += f'<line x1="{x + 22}" y1="{y + 186}" x2="{x + 222}" y2="{y + 186}" stroke="{{stroke}}"/>'
    for i, (k, v) in enumerate([("승률", "청산 기준"), ("손익비", "이익÷손실"), ("MDD", "최대 낙폭"), ("벤치마크", "코스피 대비")]):
        b += f'<rect x="{x + 240}" y="{y + 94 + i * 24}" width="128" height="20" rx="6" fill="{{card2}}" stroke="{{stroke}}"/>'
        b += T(x + 250, y + 108 + i * 24, k, 11, "mint", 700) + T(x + 360, y + 108 + i * 24, v, 10, "sub", 500, "end")
    b += T(x + 22, y + 210, "전체 요약 → 봇 비교 → 봇 상세 → 개별 거래", 12, "sub", 500)

    # F3: 신뢰 점수 링 + 조건
    x, y = 20, 260
    cx, cy, r = x + 66, y + 146, 34
    circ = 2 * 3.14159 * r
    full = f"{circ * 0.78:.1f} {circ:.1f}"
    b += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{{faint}}" stroke-width="8"/>'
    b += (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{{mint}}" stroke-width="8" stroke-linecap="round" '
          f'stroke-dasharray="{full}" transform="rotate(-90 {cx} {cy})">'
          f'<animate attributeName="stroke-dasharray" values="0 {circ:.1f};{full};{full}" keyTimes="0;0.4;1" dur="5s" repeatCount="indefinite"/></circle>')
    b += T(cx, cy + 4, "78", 22, "text", 800, "middle") + T(cx, cy + 20, "신뢰 점수", 9, "sub", 600, "middle")
    for i, (mark, s, c) in enumerate([("✓", "거래량 3.4배 (기준 3배)", "mint"), ("✓", "직전 고점 12,300원 돌파", "mint"),
                                       ("✗", "매수 잔량 1.1배 (기준 1.2배)", "red"), ("→", "방향 적중 · 목표 67% 도달", "orange")]):
        b += T(x + 124, y + 118 + i * 24, mark, 13, c, 800) + T(x + 144, y + 118 + i * 24, s, 12, "text", 500)
    b += T(x + 22, y + 210, "근거는 규칙 id와 숫자로만 · 자유 문장 없음", 12, "sub", 500)

    # F4: 나 vs 봇
    x, y = 430, 260
    for i, (k, me, bot) in enumerate([("승률", 44, 58), ("손익비", 36, 52), ("적중률", 30, 62)]):
        gx = x + 40 + i * 76
        base = y + 186
        b += f'<rect x="{gx}" y="{base - me}" width="22" height="{me}" rx="4" fill="{{orange}}"/>'
        b += (f'<rect x="{gx + 26}" y="{base - bot}" width="22" height="{bot}" rx="4" fill="{{mint}}">'
              f'<animate attributeName="height" values="{bot - 14};{bot};{bot - 14}" dur="5s" repeatCount="indefinite"/>'
              f'<animate attributeName="y" values="{base - bot + 14};{base - bot};{base - bot + 14}" dur="5s" repeatCount="indefinite"/></rect>')
        b += T(gx + 24, base + 16, k, 11, "sub", 600, "middle")
    b += f'<line x1="{x + 30}" y1="{y + 186}" x2="{x + 250}" y2="{y + 186}" stroke="{{stroke}}"/>'
    b += f'<rect x="{x + 276}" y="{y + 108}" width="10" height="10" rx="2" fill="{{orange}}"/>' + T(x + 292, y + 117, "나 (직접)", 12, "text", 600)
    b += f'<rect x="{x + 276}" y="{y + 132}" width="10" height="10" rx="2" fill="{{mint}}"/>' + T(x + 292, y + 141, "봇", 12, "text", 600)
    b += T(x + 276, y + 168, "예시 그래프", 10, "sub", 500)

    # 공통
    b += card(20, 500, 800, 48, rx=14, stroke="orange")
    b += T(44, 529, "공통", 13, "orange", 800)
    for i, s in enumerate(["텔레그램 알림", "킬 스위치 (1초 안 정지)", "손실 중지 자동", "종목 잠금 · 주문 폭주 방지"]):
        bx = 100 + i * 180
        b += f'<circle cx="{bx}" cy="524" r="4" fill="{{orange}}"/>' + T(bx + 12, 529, s, 13, "text", 600)
    return svg(h, b, bg=False)


def bot_types():
    h = 320
    bots = [("스캘핑", "분 단위", "거래량 급증 + 고점 돌파", "하루 -3% · 누적 -10%", "백로그", "cyan",
             "0,30 8,22 16,34 24,14 32,26 40,8 48,20 56,4"),
            ("데이 트레이딩", "당일 청산", "VWAP 지지 확인", "하루 -4% · 누적 -10%", "M3 첫 봇", "mint",
             "0,34 10,28 20,30 30,20 40,22 50,12 60,14"),
            ("스윙", "며칠~몇 주 · 이월", "20일선 근접 + RSI 반등", "종목당 -5% · 누적 -10%", "M6", "orange",
             "0,30 15,26 30,32 45,18 60,8"),
            ("종가 베팅", "다음 날 매도 · 이월", "마감 직전 고가 유지", "1회 -3% · 누적 -10%", "M6", "yellow",
             "0,30 20,24 34,10 40,14 46,4 60,6")]
    b = ""
    for i, (name, hold, entry, loss, ms, c, spark) in enumerate(bots):
        x = 20 + i * 202
        b += card(x, 20, 192, 236)
        b += f'<rect x="{x}" y="20" width="192" height="4" rx="2" fill="{{{c}}}"/>'
        b += T(x + 18, 56, name, 17, "text", 800)
        sp = " ".join(f"{x + 120 + int(p.split(',')[0])},{38 + int(p.split(',')[1])}" for p in spark.split())
        b += (f'<polyline points="{sp}" fill="none" stroke="{{{c}}}" stroke-width="2" stroke-linejoin="round">'
              f'<animate attributeName="opacity" values="1;0.45;1" dur="{3 + i}s" repeatCount="indefinite"/></polyline>')
        b += pill(x + 18, 76, 156, hold, c, 11)
        b += T(x + 18, 124, "진입 신호", 11, "sub", 600) + T(x + 18, 144, entry, 12, "text", 600)
        b += T(x + 18, 176, "손실 중지 (중립)", 11, "sub", 600) + T(x + 18, 196, loss, 12, "red", 700)
        b += f'<line x1="{x + 18}" y1="214" x2="{x + 174}" y2="214" stroke="{{stroke}}"/>'
        b += T(x + 18, 238, "도입", 11, "sub", 600) + T(x + 174, 238, ms, 12, c, 800, "end")
    b += '<rect x="40" y="288.5" width="760" height="3" rx="1.5" fill="url(#gLine)"/>'
    b += '<path d="M792 284l10 6-10 6" fill="{orange}"/>'
    b += T(40, 312, "짧게 보유", 11, "sub", 600) + T(420, 312, "보유 기간", 11, "sub", 700, "middle") + T(800, 312, "밤을 넘겨 보유", 11, "sub", 600, "end")
    b += '<circle cx="40" cy="290" r="5" fill="{mint}"><animate attributeName="cx" values="40;790;40" dur="10s" repeatCount="indefinite"/></circle>'
    return svg(h, b, bg=False)


def flow():
    h = 320
    path = "M110 110 H650 C770 110 770 240 650 240 H110 C-10 240 -10 110 110 110 Z"
    steps = [("시세 읽기", "공용 스냅샷"), ("규칙 평가", "점수·예측 계산"), ("리스크·자금 검사", "막히면 건너뛴 판단"),
             ("판단 기록", "근거 카드 저장"), ("주문", "clientOrderId = 판단 id"), ("체결 반영", "손절 조건주문 등록"),
             ("청산 판단", "익절·손절·마감"), ("채점", "예측 vs 실제")]
    pos = [(110, 110), (290, 110), (470, 110), (650, 110), (650, 240), (470, 240), (290, 240), (110, 240)]
    b = f'<path d="{path}" fill="none" stroke="{{stroke}}" stroke-width="2"/>'
    b += (f'<path d="{path}" fill="none" stroke="{{mint}}" stroke-width="2" stroke-dasharray="6 10" opacity="0.7">'
          f'<animate attributeName="stroke-dashoffset" values="0;-160" dur="4s" repeatCount="indefinite"/></path>')
    b += (f'<circle r="6" fill="{{mint}}" filter="url(#soft)"><animateMotion dur="10s" repeatCount="indefinite" path="{path}"/></circle>'
          f'<circle r="3.5" fill="{{mint}}"><animateMotion dur="10s" repeatCount="indefinite" path="{path}"/></circle>')
    for i, ((name, detail), (x, y)) in enumerate(zip(steps, pos)):
        key = i == 3
        c = "orange" if key else "mint"
        if key:
            b += (f'<circle cx="{x}" cy="{y}" r="26" fill="none" stroke="{{orange}}"><animate attributeName="r" values="26;40" dur="2s" repeatCount="indefinite"/>'
                  f'<animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/></circle>')
        b += f'<circle cx="{x}" cy="{y}" r="26" fill="{{card}}" stroke="{{{c}}}" stroke-width="2.5"/>'
        b += T(x, y + 7, str(i + 1), 20, c, 800, "middle", font=MONO)
        b += T(x, y + 48, name, 14, "text", 800, "middle") + T(x, y + 66, detail, 11, "sub", 500, "middle")
    b += card(560, 18, 180, 50, rx=12, stroke="orange")
    b += T(650, 39, "주문보다 근거가 먼저", 13, "orange", 800, "middle") + T(650, 57, "저장 실패 → 주문 안 함", 11, "sub", 600, "middle")
    b += '<line x1="650" y1="68" x2="650" y2="82" stroke="{orange}" stroke-width="2"/>'
    b += T(24, 34, "LOOP · 장중 09:00–15:30 반복", 12, "sub", 600, font=MONO)
    return svg(h, b, bg=False)


def rationale():
    h = 360
    b = card(20, 20, 400, 320)
    b += '<rect x="20" y="20" width="400" height="52" rx="16" fill="{mint}" fill-opacity="0.12"/>'
    b += T(40, 44, "근거 카드", 15, "mint", 800) + T(400, 44, "스캘핑봇A v3", 12, "sub", 600, "end", MONO)
    b += T(40, 63, "10:12:30 · 000000 · 12,350원", 12, "text", 500, font=MONO)
    rows = [("충족", "거래량 3.4배 (기준 3배) · 고점 12,300원 돌파", "mint"),
            ("탈락", "매수 잔량 1.1배 (기준 1.2배) · 가중치 낮음", "red"),
            ("예측", "상승 · 목표 12,470원 · 손절 12,290원 · 3분", "cyan"),
            ("결과", "청산 12,430원 · 2분 40초 · 고가 12,450원", "orange")]
    for i, (k, v, c) in enumerate(rows):
        y = 90 + i * 38
        b += pill(40, y, 48, k, c, 11, 24) + T(100, y + 16, v, 12, "text", 500)
    b += '<line x1="40" y1="250" x2="400" y2="250" stroke="{stroke}"/>'
    b += T(40, 274, "채점", 13, "text", 800)
    b += T(40, 300, "방향", 11, "sub", 600) + T(40, 320, "적중 ✓", 14, "mint", 800)
    b += T(130, 300, "목표 도달률", 11, "sub", 600)
    b += '<rect x="130" y="309" width="140" height="10" rx="5" fill="{faint}"/>'
    b += ('<rect x="130" y="309" width="94" height="10" rx="5" fill="{mint}">'
          '<animate attributeName="width" values="0;94;94" keyTimes="0;0.4;1" dur="5s" repeatCount="indefinite"/></rect>')
    b += T(278, 319, "67%", 12, "text", 800)
    b += T(330, 300, "예측 오차", 11, "sub", 600) + T(330, 320, "-0.3%", 14, "orange", 800)

    # 오른쪽: 가격 경로
    b += card(440, 20, 380, 320)

    def py(p):
        return 300 - (p - 12250) * 0.88
    x0, x1 = 480, 740
    b += T(460, 46, "가격 경로 (예시)", 12, "sub", 700)
    for p, label, c, dash in [(12470, "목표 12,470", "mint", "6 5"), (12350, "진입 12,350", "sub", "2 4"), (12290, "손절 12,290", "red", "6 5")]:
        y = py(p)
        b += f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" stroke="{{{c}}}" stroke-dasharray="{dash}" stroke-opacity="0.8"/>'
        b += T(x1 + 6, y + 4, label, 10, c, 700, font=MONO)
    prices = [12350, 12362, 12344, 12378, 12401, 12392, 12424, 12450, 12441, 12430]
    pts = " ".join(f"{x0 + i * 28},{py(p):.1f}" for i, p in enumerate(prices))
    b += (f'<polyline points="{pts}" fill="none" stroke="{{text}}" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="420" stroke-dashoffset="420">'
          f'<animate attributeName="stroke-dashoffset" values="420;0;0" keyTimes="0;0.55;1" dur="6s" repeatCount="indefinite"/></polyline>')
    b += f'<circle cx="{x0}" cy="{py(12350):.1f}" r="5" fill="{{mint}}"/>' + T(x0, py(12350) + 20, "매수", 10, "mint", 700, "middle")
    ex, ey = x0 + 9 * 28, py(12430)
    b += f'<circle cx="{ex}" cy="{ey:.1f}" r="5" fill="{{orange}}"/>' + T(ex, ey + 20, "청산", 10, "orange", 700, "middle")
    hx, hy = x0 + 7 * 28, py(12450)
    b += f'<circle cx="{hx}" cy="{hy:.1f}" r="3.5" fill="{{cyan}}"/>' + T(hx, hy - 10, "고가", 10, "cyan", 700, "middle")
    bx = x0 - 18
    b += (f'<path d="M{bx + 5} {py(12350):.1f}H{bx}V{py(12470):.1f}H{bx + 5}" fill="none" stroke="{{faint}}" stroke-width="2"/>'
          f'<path d="M{bx + 5} {py(12350):.1f}H{bx}V{py(12450):.1f}H{bx + 5}" fill="none" stroke="{{mint}}" stroke-width="2"/>')
    b += T(bx - 4, py(12400) + 4, "67%", 10, "mint", 800, "end")
    b += T(x0, 326, "0:00", 10, "sub", 500, "middle", MONO) + T(ex, 326, "2:40", 10, "sub", 500, "middle", MONO)
    return svg(h, b, bg=False)


def gate():
    h = 290
    b = card(20, 60, 200, 170, stroke="cyan")
    b += pill(40, 80, 60, "검증 중", "cyan", 12, 24) + T(40, 136, "소액 실전", 18, "text", 800)
    b += T(40, 160, "실제 계좌로 매매", 12, "sub", 500) + T(40, 178, "투자금 상한 (예: 10만 원)", 12, "sub", 500)
    b += T(40, 210, "신규 봇은 여기서 시작", 12, "cyan", 700)

    b += card(270, 20, 300, 250)
    b += T(290, 48, "상한 해제 게이트", 15, "text", 800) + T(550, 48, "모두 통과", 11, "orange", 700, "end")
    crit = [("검증 기간", "10거래일 이상"), ("청산 거래 수", "30건 이상"), ("순손익 (비용 차감)", "0원 초과"),
            ("손익비", "1.5 이상"), ("MDD", "누적 한도의 절반 이하")]
    for i, (k, v) in enumerate(crit):
        y = 66 + i * 36
        t0 = 0.08 + i * 0.13
        b += f'<rect x="286" y="{y}" width="268" height="30" rx="8" fill="{{card2}}" stroke="{{stroke}}"/>'
        b += (f'<circle cx="304" cy="{y + 15}" r="9" fill="{{mint}}" opacity="0.2">'
              f'<animate attributeName="opacity" values="0.2;0.2;1;1;0.2" keyTimes="0;{t0:.2f};{t0 + 0.04:.2f};0.92;1" dur="7s" repeatCount="indefinite"/></circle>')
        b += f'<path d="M299.5 {y + 15}l3 3 6-6" stroke="{{bg0}}" stroke-width="2" fill="none" stroke-linecap="round"/>'
        b += T(322, y + 20, k, 12, "text", 600) + T(544, y + 20, v, 12, "mint", 700, "end")
    b += T(420, 262, "서버에서 강제 · 판단이 바뀌는 변경만 다시 검증", 10, "sub", 500, "middle")

    b += card(620, 60, 200, 170, stroke="orange")
    b += pill(640, 80, 60, "해제", "orange", 12, 24) + T(640, 136, "투자금 확대", 18, "text", 800)
    b += T(640, 160, "운용 자산 기준 새로 확정", 12, "sub", 500) + T(640, 178, "진입 직후 손절 조건주문", 12, "sub", 500)
    b += T(640, 210, "이상하면 킬 스위치", 12, "orange", 700)
    for x1, x2, c in [(222, 268, "cyan"), (572, 618, "orange")]:
        b += (f'<line x1="{x1}" y1="145" x2="{x2 - 6}" y2="145" stroke="{{{c}}}" stroke-width="2" stroke-dasharray="4 5">'
              f'<animate attributeName="stroke-dashoffset" values="0;-18" dur="1s" repeatCount="indefinite"/></line>'
              f'<path d="M{x2 - 8} 139l8 6-8 6" fill="{{{c}}}"/>')
    return svg(h, b, bg=False)


def architecture():
    h = 380

    def box(x, y, w, hh, title, sub, c="stroke", tc="text"):
        return (card(x, y, w, hh, rx=12, stroke=c) + T(x + w / 2, y + hh / 2 - 2, title, 13, tc, 800, "middle")
                + T(x + w / 2, y + hh / 2 + 15, sub, 10, "sub", 500, "middle"))

    def flowline(d, c="mint", dur="1.2s"):
        return (f'<path d="{d}" fill="none" stroke="{{{c}}}" stroke-opacity="0.35" stroke-width="2"/>'
                f'<path d="{d}" fill="none" stroke="{{{c}}}" stroke-width="2" stroke-dasharray="4 8">'
                f'<animate attributeName="stroke-dashoffset" values="12;0" dur="{dur}" repeatCount="indefinite"/></path>')
    b = flowline("M170 66 H210") + flowline("M210 86 H170", "mint", "1.6s") + flowline("M170 180 H210", "cyan")
    b += flowline("M410 266 V292") + flowline("M620 318 H660") + flowline("M740 230 V290")
    b += flowline("M610 70 H660", "orange")
    b += box(20, 40, 150, 70, "토스증권 오픈API", "REST · 웹소켓 · 허용 IP", "mint", "mint")
    b += box(20, 150, 150, 60, "DART Open API", "장전 공시 점검", "cyan", "cyan")
    b += T(95, 246, "외부 API는 engine의", 10, "sub", 500, "middle") + T(95, 260, "TossClient 한 곳만 호출", 10, "sub", 500, "middle")

    b += card(210, 20, 400, 246, rx=16, stroke="mint")
    b += T(230, 46, "engine", 15, "mint", 800, font=MONO) + T(590, 46, "장중 매매 루프 · 배치", 11, "sub", 600, "end")
    chips = [("TossClient", "토큰 1개 · rate limiter"), ("MarketCollector", "웹소켓 1개로 시세"),
             ("AccountSync", "체결 이벤트 + 재동기화"), ("Broker", "Toss(실전) | Paper(점검)"),
             ("BotRunner", "봇마다 8단계 루프"), ("Scheduler", "장전·장후 배치"),
             ("Notifier", "텔레그램 알림"), ("DartClient", "공시 목록")]
    for i, (n, d) in enumerate(chips):
        cx, cy = 228 + (i % 2) * 188, 62 + (i // 2) * 48
        c = "orange" if n in ("BotRunner", "Broker") else "stroke"
        b += f'<rect x="{cx}" y="{cy}" width="176" height="40" rx="9" fill="{{card2}}" stroke="{{{c}}}"/>'
        b += T(cx + 12, cy + 17, n, 12, "orange" if c == "orange" else "text", 700, font=MONO) + T(cx + 12, cy + 32, d, 10, "sub", 500)

    b += box(660, 40, 160, 60, "Telegram", "체결 · 손절 · 한도 · 오류", "orange", "orange")
    b += box(660, 170, 160, 60, "web", "Next.js · F1~F4 화면")
    b += box(660, 290, 160, 56, "api", "조회 · 봇 설정 · 명령")
    b += card(210, 292, 410, 54, rx=12, stroke="mint")
    b += T(415, 315, "PostgreSQL", 14, "text", 800, "middle", MONO) + T(415, 333, "모든 상태의 단일 출처 · LISTEN/NOTIFY로 정지·청산 명령", 10, "sub", 500, "middle")
    b += T(420, 372, "고정 IP VM 1대 · Docker Compose (api · engine · web · postgres)", 11, "sub", 600, "middle", MONO)
    return svg(h, b, bg=False)


def roadmap():
    h = 230
    ms = [("M0", "사전 확인", "1~2일"), ("M1", "기반", "2주"), ("M2", "엔진", "2주"), ("M3", "첫 봇 (점검)", "1주"),
          ("M4", "화면", "2주"), ("M5", "소액 실전", "1주"), ("M6", "이월 봇", "2주"), ("M7", "확장", "필요 시")]
    xs = [70 + i * 100 for i in range(8)]
    b = f'<line x1="{xs[0]}" y1="96" x2="{xs[-1]}" y2="96" stroke="{{faint}}" stroke-width="4" stroke-linecap="round"/>'
    b += (f'<line x1="{xs[0]}" y1="96" x2="{xs[0] + 50}" y2="96" stroke="{{mint}}" stroke-width="4" stroke-linecap="round">'
          f'<animate attributeName="x2" values="{xs[0]};{xs[0] + 50};{xs[0] + 50}" keyTimes="0;0.5;1" dur="4s" repeatCount="indefinite"/></line>')
    for i, ((m, name, dur), x) in enumerate(zip(ms, xs)):
        now = i == 0
        c = "mint" if now else ("orange" if m == "M5" else "sub")
        if now:
            b += (f'<circle cx="{x}" cy="96" r="13" fill="none" stroke="{{mint}}"><animate attributeName="r" values="13;24" dur="2s" repeatCount="indefinite"/>'
                  f'<animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/></circle>')
        b += f'<circle cx="{x}" cy="96" r="13" fill="{{card}}" stroke="{{{c}}}" stroke-width="2.5"/>'
        b += f'<circle cx="{x}" cy="96" r="5" fill="{{{c}}}"/>' if now else ""
        b += T(x, 62, m, 14, c, 800, "middle", MONO)
        b += T(x, 134, name, 13, "text", 800, "middle") + T(x, 152, dur, 11, "sub", 500, "middle")
    b += pill(xs[0] - 34, 20, 68, "지금 여기", "mint", 11, 22)
    mid = (xs[3] + xs[5]) / 2
    b += (f'<path d="M{xs[3]} 170 Q{mid} 214 {xs[5]} 170" fill="none" stroke="{{orange}}" stroke-width="1.5" stroke-dasharray="4 4"/>'
          + T(mid, 206, "점검 통과 후 바로 소액 실전", 11, "orange", 700, "middle"))
    return svg(h, b, bg=False)


def divider():
    h = 28
    b = ('<rect x="60" y="13" width="330" height="1.5" fill="url(#gLine)"/>'
         '<rect x="450" y="13" width="330" height="1.5" fill="url(#gLine)" transform="rotate(180 615 13.75)"/>')
    for i, (y, hh, c) in enumerate([(8, 12, "mint"), (5, 16, "red"), (3, 20, "mint")]):
        x = 402 + i * 14
        b += (f'<line x1="{x + 2.5}" y1="{y - 3}" x2="{x + 2.5}" y2="{y + hh + 3}" stroke="{{{c}}}"/>'
              f'<rect x="{x}" y="{y}" width="5" height="{hh}" rx="1" fill="{{{c}}}">'
              f'<animate attributeName="opacity" values="1;0.4;1" dur="3s" begin="{i * 0.5}s" repeatCount="indefinite"/></rect>')
    return svg(h, b, bg=False)


COMPONENTS = dict(banner=banner, concept=concept, features=features, bots=bot_types, flow=flow,
                  rationale=rationale, gate=gate, architecture=architecture, roadmap=roadmap, divider=divider)

if __name__ == "__main__":
    for name, fn in COMPONENTS.items():
        raw = fn()
        for theme, colors in THEMES.items():
            out = raw
            for k, v in colors.items():
                out = out.replace("{" + k + "}", v)
            assert "{" not in out, f"{name}: 치환 안 된 토큰"
            (OUT / f"{name}-{theme}.svg").write_text(out, encoding="utf-8")
    print("ok:", ", ".join(COMPONENTS))
