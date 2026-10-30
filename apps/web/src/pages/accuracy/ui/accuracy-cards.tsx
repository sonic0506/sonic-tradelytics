import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@xonic0506/sonic-ui';

import { type AccuracyStats, SKIP_REASON_LABEL } from '@/entities/accuracy';
import { formatRatio, formatSignedPercent } from '@/shared/lib';
import { PnlText } from '@/shared/ui';

// 봇별 방향 적중률·목표 도달률·평균 예측 오차 (FR-RAT-05)
export function BotAccuracyCard({
  summary,
}: {
  summary: AccuracyStats['summary'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>봇별 정확도</CardTitle>
        <CardDescription>
          채점한 거래 {summary.scoredCount}건 · 방향 적중률{' '}
          {formatRatio(summary.directionHitRate)} · 목표 도달률{' '}
          {formatRatio(summary.targetReachRate)}
        </CardDescription>
      </CardHeader>
      <CardBody>
        <Table aria-label="봇별 정확도" className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>봇</TableHead>
              <TableHead align="end">채점 거래</TableHead>
              <TableHead align="end">방향 적중률</TableHead>
              <TableHead align="end">목표 도달률</TableHead>
              <TableHead align="end">평균 예측 오차</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.bots.map((bot) => (
              <TableRow key={bot.botId}>
                <TableCell>{bot.name}</TableCell>
                <TableCell align="end">{bot.scoredCount}</TableCell>
                <TableCell align="end">
                  {formatRatio(bot.directionHitRate)}
                </TableCell>
                <TableCell align="end">
                  {formatRatio(bot.targetReachRate)}
                </TableCell>
                <TableCell align="end">
                  {formatSignedPercent(bot.avgErrorPct)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}

// 신뢰 점수 구간별 승률. Figma 막대 그대로 그려요 (FR-RAT-05)
export function ScoreBucketCard({
  buckets,
}: {
  buckets: AccuracyStats['scoreBuckets'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>신뢰 점수 구간별 승률</CardTitle>
        <CardDescription>점수가 높을수록 실제로 이겼는지 봐요.</CardDescription>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col gap-3">
          {buckets.map((bucket) => (
            <li key={bucket.min} className="flex items-center gap-3">
              <Text
                variant="mono-caption"
                tone="muted"
                className="w-16 shrink-0"
              >
                {bucket.min}~{bucket.max}점
              </Text>
              <div
                role="meter"
                aria-label={`${bucket.min}~${bucket.max}점 승률`}
                aria-valuenow={Math.round(bucket.winRate * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${bucket.winRate * 100}%` }}
                />
              </div>
              <Text variant="mono-caption" className="w-20 shrink-0 text-right">
                {formatRatio(bucket.winRate)} · {bucket.closedCount}건
              </Text>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

// 최초 판단 vs 재평가 판단 적중률 (FR-RAT-06)
export function ReevalCard({
  reeval,
}: {
  reeval: NonNullable<AccuracyStats['reeval']>;
}) {
  const gap = Math.round((reeval.reevalHitRate - reeval.initialHitRate) * 100);
  const rows = [
    {
      label: '최초 판단 적중률',
      rate: reeval.initialHitRate,
      count: reeval.initialCount,
    },
    {
      label: '재평가 판단 적중률',
      rate: reeval.reevalHitRate,
      count: reeval.reevalCount,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>최초 판단 vs 재평가</CardTitle>
        <CardDescription>
          날짜를 넘기는 봇의 재평가가 예측을 더 맞혔는지 봐요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 border-b border-default py-3 last:border-b-0"
            >
              <span className="flex flex-col">
                <Text>{row.label}</Text>
                <Text variant="caption" tone="muted">
                  {row.count}건
                </Text>
              </span>
              <Text variant="mono">{formatRatio(row.rate)}</Text>
            </li>
          ))}
        </ul>
        <Text as="p" variant="caption" tone="muted">
          {gap === 0
            ? '재평가 뒤에도 적중률이 같아요.'
            : `재평가 뒤 예측이 ${Math.abs(gap)}%p 더 ${gap > 0 ? '맞았어요' : '틀렸어요'}.`}
        </Text>
      </CardBody>
    </Card>
  );
}

// 조건별 기여도: 조건을 충족한 거래의 승률과 평균 손익 (FR-RAT-06)
export function ConditionCard({
  conditions,
}: {
  conditions: NonNullable<AccuracyStats['conditions']>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>조건별 기여도</CardTitle>
        <CardDescription>
          조건을 충족한 거래의 승률과 평균 손익이에요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <Table aria-label="조건별 기여도" className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>조건</TableHead>
              <TableHead align="end">거래</TableHead>
              <TableHead align="end">승률</TableHead>
              <TableHead align="end">평균 손익</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.map((condition) => (
              <TableRow key={condition.label}>
                <TableCell>{condition.label}</TableCell>
                <TableCell align="end">{condition.tradeCount}</TableCell>
                <TableCell align="end">
                  {formatRatio(condition.winRate)}
                </TableCell>
                <TableCell align="end">
                  <PnlText value={condition.avgPnlRate}>
                    {formatSignedPercent(condition.avgPnlRate)}
                  </PnlText>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}

// 건너뛴 판단: 사유별 수와 그날 종가까지 평균 등락 (FR-RAT-03, 04)
export function SkippedCard({
  skipped,
}: {
  skipped: NonNullable<AccuracyStats['skipped']>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>건너뛴 판단</CardTitle>
        <CardDescription>
          진입하지 않은 판단과 그 뒤 그날 종가까지의 평균 등락이에요.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <Table aria-label="건너뛴 판단" className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>사유</TableHead>
              <TableHead align="end">건수</TableHead>
              <TableHead align="end">이후 등락</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skipped.map((item) => (
              <TableRow key={item.reason}>
                <TableCell>{SKIP_REASON_LABEL[item.reason]}</TableCell>
                <TableCell align="end">{item.count}</TableCell>
                <TableCell align="end">
                  {formatSignedPercent(item.avgChangePct)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
