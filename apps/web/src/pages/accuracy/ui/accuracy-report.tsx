'use client';

import { Card, EmptyState, Skeleton } from '@xonic0506/sonic-ui';

import {
  type GetAccuracyStatsParams,
  useAccuracyStatsQuery,
} from '@/entities/accuracy';

import {
  BotAccuracyCard,
  ConditionCard,
  ReevalCard,
  ScoreBucketCard,
  SkippedCard,
} from './accuracy-cards';

// 정확도 분석 본문 (Figma Accuracy). 응답에 없는 Should 섹션은 그리지 않아요
export function AccuracyReport({ params }: { params: GetAccuracyStatsParams }) {
  const { data } = useAccuracyStatsQuery(params);
  if (data.summary.scoredCount === 0) {
    return (
      <Card>
        <EmptyState
          title="채점한 거래가 없어요"
          description="봇이 청산을 마치면 예측을 채점해 여기에 모아요."
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <BotAccuracyCard summary={data.summary} />
      <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-4">
        <div className={data.reeval ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <ScoreBucketCard buckets={data.scoreBuckets} />
        </div>
        {data.reeval && (
          <div className="lg:col-span-2">
            <ReevalCard reeval={data.reeval} />
          </div>
        )}
      </div>
      {(data.conditions ?? data.skipped) && (
        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-4">
          {data.conditions && <ConditionCard conditions={data.conditions} />}
          {data.skipped && <SkippedCard skipped={data.skipped} />}
        </div>
      )}
    </div>
  );
}

export function AccuracyReportSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Card className="gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} shape="rect" className="h-10" />
        ))}
      </Card>
      <Card className="gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} shape="text" />
        ))}
      </Card>
    </div>
  );
}
