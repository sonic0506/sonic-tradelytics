import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Text,
} from '@xonic0506/sonic-ui';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
  EntryDecision,
  PositionOutcome,
  PositionScoring,
} from '@/entities/position';
import {
  formatMonthDayTime,
  formatSignedPercent,
  formatWon,
} from '@/shared/lib';

import { DIRECTION_LABEL, formatHoldingTime } from '../lib/rationale-text';

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-body text-muted">{label}</dt>
      <dd className="text-right text-body text-default">{value}</dd>
    </div>
  );
}

function ScoreRow({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-default py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <Text>{label}</Text>
        <Text variant="caption" tone="muted">
          {note}
        </Text>
      </div>
      {children}
    </li>
  );
}

type ResultScoringCardProps = {
  entry: EntryDecision | null;
  outcome: PositionOutcome | null;
  scoring: PositionScoring | null;
  pendingText: string;
};

// 결과와 채점: 청산 뒤 실제 결과를 붙여 자동 채점 (Figma Rationale / 결과와 채점, FR-RAT-02)
export function ResultScoringCard({
  entry,
  outcome,
  scoring,
  pendingText,
}: ResultScoringCardProps) {
  if (!entry || !outcome || !scoring) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>결과와 채점</CardTitle>
          <CardDescription>
            청산하면 실제 결과를 붙여 자동으로 채점해요.
          </CardDescription>
        </CardHeader>
        <EmptyState
          icon={<Inbox />}
          title="아직 채점 전이에요"
          description={pendingText}
        />
      </Card>
    );
  }
  const predicted = DIRECTION_LABEL[entry.prediction.direction];
  return (
    <Card>
      <CardHeader>
        <CardTitle>결과와 채점</CardTitle>
        <CardDescription>
          청산 뒤 실제 결과를 붙여 자동으로 채점했어요.
        </CardDescription>
      </CardHeader>
      <CardBody className="gap-6">
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="muted">
            실제 결과
          </Text>
          <dl className="flex flex-col gap-2">
            <ResultRow label="청산가" value={formatWon(outcome.exitPrice)} />
            <ResultRow
              label="보유 시간"
              value={formatHoldingTime(outcome.holdingMinutes)}
            />
            <ResultRow
              label="보유 중 최고가"
              value={`${formatWon(outcome.highPrice)} · ${formatMonthDayTime(outcome.highAt)}`}
            />
            <ResultRow
              label="보유 중 최저가"
              value={`${formatWon(outcome.lowPrice)} · ${formatMonthDayTime(outcome.lowAt)}`}
            />
          </dl>
        </div>
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="muted">
            채점
          </Text>
          <ul className="flex flex-col">
            <ScoreRow label="방향" note={`${predicted} 예측`}>
              <Text>{DIRECTION_LABEL[scoring.actualDirection]}</Text>
              <Badge tone={scoring.directionHit ? 'success' : 'danger'}>
                {scoring.directionHit ? '적중' : '빗나감'}
              </Badge>
            </ScoreRow>
            <ScoreRow label="목표 도달률" note="최고가 기준, 100%에서 자름">
              <Text variant="mono">{scoring.targetReachPct}%</Text>
              <Badge
                tone={scoring.targetReachPct >= 100 ? 'success' : 'neutral'}
              >
                {scoring.targetReachPct >= 100 ? '도달' : '미달'}
              </Badge>
            </ScoreRow>
            <ScoreRow label="예측 오차" note="(청산가 − 목표가) ÷ 진입가">
              <Text variant="mono">
                {formatSignedPercent(scoring.errorPct)}
              </Text>
            </ScoreRow>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
