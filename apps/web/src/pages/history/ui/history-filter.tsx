'use client';

import { Input, Select } from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { useBotsQuery } from '@/entities/bot';
import {
  EXIT_REASON_LABEL,
  EXIT_REASONS,
  type GetPositionHistoryFilters,
  POSITION_RESULTS,
  POSITION_STATUSES,
} from '@/entities/position';
import {
  FilterActions,
  FilterField,
  FilterPanel,
  QueryBoundary,
} from '@/shared/ui';

import { STATUS_BADGE } from '../lib/history-text';

const ALL = 'all';
const RESULT_LABEL = { profit: '수익', loss: '손실' } as const;

export const EMPTY_HISTORY_FILTERS: GetPositionHistoryFilters = {
  from: null,
  to: null,
  botIds: [],
  symbol: '',
  result: null,
  status: null,
  exitReason: null,
};

const withAll = <T extends string>(
  values: readonly T[],
  label: (value: T) => string,
) => [
  { value: ALL, label: '전체' },
  ...values.map((value) => ({ value, label: label(value) })),
];
const pick = <T extends string>(values: readonly T[], value: string | null) =>
  values.find((item) => item === value) ?? null;

type BotSelectProps = {
  value: string[];
  onChange: (botIds: string[]) => void;
};

// 봇 여러 개와 직접 거래를 함께 골라요 (FR-PERF-05, 07)
function BotSelect({ value, onChange }: BotSelectProps) {
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

type HistoryFilterProps = {
  applied: GetPositionHistoryFilters;
  onApply: (filters: GetPositionHistoryFilters) => void;
};

// 기간·봇·종목·수익/손실·상태·청산 사유. 조회하기를 누르면 URL에 반영해요
export function HistoryFilter({ applied, onApply }: HistoryFilterProps) {
  const [draft, setDraft] = useState(applied);
  const update = (patch: Partial<GetPositionHistoryFilters>) =>
    setDraft((prev) => ({ ...prev, ...patch }));
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft);
  };
  const handleReset = () => {
    setDraft(EMPTY_HISTORY_FILTERS);
    onApply(EMPTY_HISTORY_FILTERS);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col">
        <FilterPanel>
          <FilterField label="기간">
            <div className="flex w-full min-w-0 items-center gap-2">
              <Input
                type="date"
                aria-label="시작일"
                className="min-w-0"
                value={draft.from ?? ''}
                onChange={(event) =>
                  update({ from: event.target.value || null })
                }
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
              loading={
                <Select
                  aria-label="봇"
                  options={[]}
                  value={null}
                  placeholder="전체"
                  disabled
                />
              }
              errorTitle="봇 목록을 불러오지 못했어요"
              errorFallback={
                <Select
                  aria-label="봇"
                  options={[]}
                  value={null}
                  placeholder="전체"
                  disabled
                />
              }
            >
              <BotSelect
                value={draft.botIds}
                onChange={(botIds) => update({ botIds })}
              />
            </QueryBoundary>
          </FilterField>
          <FilterField label="종목">
            <Input
              aria-label="종목"
              placeholder="종목명 또는 코드"
              value={draft.symbol}
              onChange={(event) => update({ symbol: event.target.value })}
            />
          </FilterField>
        </FilterPanel>
        <FilterPanel className="border-t-0">
          <FilterField label="수익/손실">
            <Select
              aria-label="수익/손실"
              options={withAll(
                POSITION_RESULTS,
                (value) => RESULT_LABEL[value],
              )}
              value={draft.result ?? ALL}
              onValueChange={(value) =>
                update({ result: pick(POSITION_RESULTS, value) })
              }
            />
          </FilterField>
          <FilterField label="상태">
            <Select
              aria-label="상태"
              options={withAll(
                POSITION_STATUSES,
                (value) => STATUS_BADGE[value].label,
              )}
              value={draft.status ?? ALL}
              onValueChange={(value) =>
                update({ status: pick(POSITION_STATUSES, value) })
              }
            />
          </FilterField>
          <FilterField label="청산 사유">
            <Select
              aria-label="청산 사유"
              options={withAll(
                EXIT_REASONS,
                (value) => EXIT_REASON_LABEL[value],
              )}
              value={draft.exitReason ?? ALL}
              onValueChange={(value) =>
                update({ exitReason: pick(EXIT_REASONS, value) })
              }
            />
          </FilterField>
        </FilterPanel>
      </div>
      <FilterActions onReset={handleReset} onApply={() => onApply(draft)} />
    </form>
  );
}
