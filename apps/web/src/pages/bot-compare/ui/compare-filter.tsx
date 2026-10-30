'use client';

import { Input, Select } from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { BOT_STAGE_LABEL, useBotsQuery } from '@/entities/bot';
import { type BotStage, botStageSchema } from '@/shared/api';
import {
  FilterActions,
  FilterField,
  FilterPanel,
  QueryBoundary,
} from '@/shared/ui';

const ALL = 'all';
const STAGE_OPTIONS = [
  { value: ALL, label: '전체' },
  ...botStageSchema.options.map((stage) => ({
    value: stage,
    label: BOT_STAGE_LABEL[stage],
  })),
];

export type CompareFilters = {
  from: string | null;
  to: string | null;
  botIds: string[];
  stage: BotStage | null;
};

export const EMPTY_COMPARE_FILTERS: CompareFilters = {
  from: null,
  to: null,
  botIds: [],
  stage: null,
};

function BotSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (botIds: string[]) => void;
}) {
  const { data: bots } = useBotsQuery();
  const options = [
    ...bots.items.map((bot) => ({ value: bot.id, label: bot.name })),
    { value: 'manual', label: '직접 거래' },
  ];
  return (
    <Select
      multiple
      aria-label="봇"
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder="전체"
    />
  );
}

type CompareFilterProps = {
  applied: CompareFilters;
  onApply: (filters: CompareFilters) => void;
};

// 기간·봇·단계. 조회하기를 누르면 URL에 반영해요 (Figma Compare FilterPanel)
export function CompareFilter({ applied, onApply }: CompareFilterProps) {
  const [draft, setDraft] = useState(applied);
  const update = (patch: Partial<CompareFilters>) =>
    setDraft((prev) => ({ ...prev, ...patch }));
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft);
  };
  const handleReset = () => {
    setDraft(EMPTY_COMPARE_FILTERS);
    onApply(EMPTY_COMPARE_FILTERS);
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
        <FilterField label="단계">
          <Select
            aria-label="단계"
            options={STAGE_OPTIONS}
            value={draft.stage ?? ALL}
            onValueChange={(value) =>
              update({ stage: botStageSchema.safeParse(value).data ?? null })
            }
          />
        </FilterField>
      </FilterPanel>
      <FilterActions onReset={handleReset} onApply={() => onApply(draft)} />
    </form>
  );
}
