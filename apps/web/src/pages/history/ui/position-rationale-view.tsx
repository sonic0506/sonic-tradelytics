'use client';

import { Badge, Text } from '@xonic0506/sonic-ui';
import { ChartColumn, ScrollText, TrendingUp, Wallet } from 'lucide-react';

import { EXIT_REASON_LABEL, usePositionDetailQuery } from '@/entities/position';
import {
  formatMonthDayTime,
  formatSignedPercent,
  formatSignedWon,
} from '@/shared/lib';
import { KpiCard, PnlText } from '@/shared/ui';

import { STATUS_BADGE } from '../lib/history-text';
import { DIRECTION_LABEL } from '../lib/rationale-text';
import { EntryDecisionCard } from './entry-decision-card';
import { ReevalTimelineCard } from './reeval-timeline-card';
import { ResultScoringCard } from './result-scoring-card';

const NOT_SCORED = '청산 뒤 채점해요';

// 근거 카드: 거래 1건의 판단·결과·채점 (F3, Figma Rationale)
export function PositionRationaleView({ positionId }: { positionId: string }) {
  const { data } = usePositionDetailQuery(positionId);
  const { position, entry, outcome, scoring, timeline } = data;
  const badge = STATUS_BADGE[position.status];
  const isHolding = position.status === 'holding';
  const botLabel = position.botName
    ? `${position.botName}${data.botVersion ? ` v${data.botVersion}` : ''}`
    : '직접 거래';
  const metaParts = [
    botLabel,
    `진입 ${formatMonthDayTime(position.enteredAt)}`,
    position.exitedAt
      ? `청산 ${formatMonthDayTime(position.exitedAt)}`
      : badge.label,
    ...(position.exitReason ? [EXIT_REASON_LABEL[position.exitReason]] : []),
  ];
  const passed =
    entry?.conditions.filter((condition) => condition.passed).length ?? 0;
  const failed = (entry?.conditions.length ?? 0) - passed;
  const pendingText = isHolding
    ? '지금은 보유 중이라 실제 결과가 없어요. 청산하면 바로 채점해요.'
    : '체결된 거래가 없어서 채점하지 않아요.';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="h1" variant="display">
            {position.symbolName}
          </Text>
          <Text variant="mono" tone="muted">
            {position.symbolCode}
          </Text>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <Text as="p" tone="muted">
          {metaParts.join(' · ')}
        </Text>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={ScrollText}
          label="신뢰 점수"
          value={
            <Text variant="title">{entry ? `${entry.score}점` : '−'}</Text>
          }
          detail={
            <Text variant="mono-caption" tone="muted">
              {entry ? `${passed}개 충족 · ${failed}개 탈락` : '판단 기록 없음'}
            </Text>
          }
        />
        <KpiCard
          icon={TrendingUp}
          label="방향"
          value={
            <Text variant="title">
              {scoring ? (scoring.directionHit ? '적중' : '빗나감') : '−'}
            </Text>
          }
          detail={
            <Text variant="mono-caption" tone="muted">
              {scoring && entry
                ? `${DIRECTION_LABEL[entry.prediction.direction]} 예측 → ${DIRECTION_LABEL[scoring.actualDirection]}`
                : NOT_SCORED}
            </Text>
          }
        />
        <KpiCard
          icon={ChartColumn}
          label="목표 도달률"
          value={
            <Text variant="title">
              {scoring ? `${scoring.targetReachPct}%` : '−'}
            </Text>
          }
          detail={
            <Text variant="mono-caption" tone="muted">
              {outcome
                ? `최고가 ${outcome.highPrice.toLocaleString('ko-KR')}원`
                : NOT_SCORED}
            </Text>
          }
        />
        <KpiCard
          icon={Wallet}
          label={isHolding ? '평가 손익' : '순손익'}
          value={
            <PnlText value={position.netPnl} variant="title">
              {formatSignedWon(position.netPnl)}
            </PnlText>
          }
          detail={
            <PnlText value={position.netPnl} variant="mono-caption">
              {formatSignedPercent(position.netPnlRate)}
            </PnlText>
          }
        />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-4">
        <div className="lg:col-span-3">
          <EntryDecisionCard entry={entry} botLabel={botLabel} />
        </div>
        <div className="lg:col-span-2">
          <ResultScoringCard
            entry={entry}
            outcome={outcome}
            scoring={scoring}
            pendingText={pendingText}
          />
        </div>
      </div>
      <ReevalTimelineCard timeline={timeline} />
    </div>
  );
}
