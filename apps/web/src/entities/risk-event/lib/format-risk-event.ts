import { formatSignedWon } from '@/shared/lib';

import type { RiskEvent } from '../model/risk-event.schema';

// detail은 종류마다 키가 달라서, 아는 키만 숫자인지 확인하고 읽어요
function readNumber(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === 'number' ? value : null;
}

// 손익과 확정 투자금 대비 %. "−93,000원(−3.1%)"
function lossText(pnl: number | null, amount: number | null) {
  if (pnl === null) return null;
  if (!amount) return formatSignedWon(pnl);
  const percent = ((pnl / amount) * 100).toFixed(1).replace('-', '−');
  return `${formatSignedWon(pnl)}(${percent}%)`;
}

// 리스크 이벤트 한 줄 문구. 서버는 kind와 detail만 줘요 (서버 RiskEventResponseDto)
export function formatRiskEventMessage({ kind, detail }: RiskEvent): string {
  switch (kind) {
    case 'daily_stop': {
      const loss = lossText(
        readNumber(detail, 'dailyPnl'),
        readNumber(detail, 'amount'),
      );
      return `${loss ? `하루 손익 ${loss}로 ` : ''}하루 손실 한도에 닿아 오늘 신규 진입을 멈췄어요.`;
    }
    case 'total_stop': {
      const loss = lossText(
        readNumber(detail, 'totalPnl'),
        readNumber(detail, 'amount'),
      );
      return `${loss ? `누적 손익 ${loss}로 ` : ''}누적 손실 한도에 닿아 봇을 끝냈어요.`;
    }
    case 'streak_pause': {
      const count = readNumber(detail, 'stopStreak');
      return `${count === null ? '연속으로' : `${count}번 연속`} 손절해서 일시정지했어요. 재개는 직접 눌러야 해요.`;
    }
    case 'rate_cap':
      return '주문 횟수 상한을 넘어 주문을 멈췄어요.';
    case 'kill_switch':
      return detail.liquidateAll === true
        ? '킬 스위치로 모든 봇을 멈추고 보유 종목을 청산했어요.'
        : '킬 스위치로 모든 봇을 멈췄어요.';
    case 'batch_fail':
      return '정해진 배치 작업이 실패했어요. 엔진 로그를 확인해 주세요.';
    case 'feed_stale':
      return '시세가 끊겨 해당 종목의 신규 진입을 멈췄어요.';
    case 'record_fail':
      return '판단 기록을 저장하지 못해 신규 진입을 멈췄어요.';
    case 'order_rejected':
      return '주문이 거부됐어요. 주문 내역을 확인해 주세요.';
    case 'funds_waiting':
      return '투자금을 확정하지 못해 자금 대기로 바꿨어요.';
    case 'bot_error':
      return '봇 실행 중 오류가 나서 이번 주기를 건너뛰었어요.';
  }
}
