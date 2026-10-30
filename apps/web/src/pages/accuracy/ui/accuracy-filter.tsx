'use client';

import { Input, Select } from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import type { GetAccuracyStatsParams } from '@/entities/accuracy';
import { useBotOptionsQuery } from '@/entities/bot';
import {
  FilterActions,
  FilterField,
  FilterPanel,
  QueryBoundary,
} from '@/shared/ui';

export const EMPTY_ACCURACY_FILTERS: GetAccuracyStatsParams = {
  from: null,
  to: null,
  botIds: [],
};

function BotSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (botIds: string[]) => void;
}) {
  const { data: botOptions } = useBotOptionsQuery();
  return (
    <Select
      multiple
      aria-label="봇"
      options={botOptions}
      value={value}
      onValueChange={onChange}
      placeholder="전체"
    />
  );
}

type AccuracyFilterProps = {
  applied: GetAccuracyStatsParams;
  onApply: (filters: GetAccuracyStatsParams) => void;
};

// 기간·봇 (Figma Accuracy FilterPanel). 직접 거래는 판단이 없어서 고르지 않아요
export function AccuracyFilter({ applied, onApply }: AccuracyFilterProps) {
  const [draft, setDraft] = useState(applied);
  const update = (patch: Partial<GetAccuracyStatsParams>) =>
    setDraft((prev) => ({ ...prev, ...patch }));
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft);
  };
  const handleReset = () => {
    setDraft(EMPTY_ACCURACY_FILTERS);
    onApply(EMPTY_ACCURACY_FILTERS);
  };
  const disabledBotSelect = (
    <Select
      aria-label="봇"
      options={[]}
      value={null}
      placeholder="전체"
      disabled
    />
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <FilterPanel>
        <FilterField label="기간">
          <div className="flex w-full min-w-0 items-center gap-2">
            <Input
              type="date"
              aria-label="시작일"
              className="min-w-0"
              value={draft.from ?? ''}
              onChange={(event) => update({ from: event.target.value || null })}
            />
            <span aria-hidden className="text-muted">
              -
            </span>
            <Input
              type="date"
              aria-label="종료일"
              className="min-w-0"
              value={draft.to ?? ''}
              onChange={(event) => update({ to: event.target.value || null })}
            />
          </div>
        </FilterField>
        <FilterField label="봇">
          <QueryBoundary
            loading={disabledBotSelect}
            errorTitle="봇 목록을 불러오지 못했어요"
            errorFallback={disabledBotSelect}
          >
            <BotSelect
              value={draft.botIds}
              onChange={(botIds) => update({ botIds })}
            />
          </QueryBoundary>
        </FilterField>
      </FilterPanel>
      <FilterActions onReset={handleReset} onApply={() => onApply(draft)} />
    </form>
  );
}
