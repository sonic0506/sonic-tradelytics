'use client';

import { Input, Select } from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { useBotsQuery } from '@/entities/bot';
import { RISK_EVENT_KINDS, type RiskEventKind } from '@/entities/risk-event';
import {
  FilterActions,
  FilterField,
  FilterPanel,
  QueryBoundary,
} from '@/shared/ui';

import { OPS_KIND_BADGE } from '../lib/ops-text';

const ALL = 'all';
const KIND_OPTIONS = [
  { value: ALL, label: '전체' },
  ...RISK_EVENT_KINDS.map((kind) => ({
    value: kind,
    label: OPS_KIND_BADGE[kind].label,
  })),
];

export type OpsFilters = {
  from: string | null;
  to: string | null;
  botIds: string[];
  kind: RiskEventKind | null;
};

export const EMPTY_OPS_FILTERS: OpsFilters = {
  from: null,
  to: null,
  botIds: [],
  kind: null,
};

function BotSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (botIds: string[]) => void;
}) {
  const { data: bots } = useBotsQuery();
  return (
    <Select
      multiple
      aria-label="봇"
      options={bots.items.map((bot) => ({ value: bot.id, label: bot.name }))}
      value={value}
      onValueChange={onChange}
      placeholder="전체"
    />
  );
}

type OpsFilterProps = {
  applied: OpsFilters;
  onApply: (filters: OpsFilters) => void;
};

// 기간·봇·종류 (Figma Ops FilterPanel)
export function OpsFilter({ applied, onApply }: OpsFilterProps) {
  const [draft, setDraft] = useState(applied);
  const update = (patch: Partial<OpsFilters>) =>
    setDraft((prev) => ({ ...prev, ...patch }));
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft);
  };
  const handleReset = () => {
    setDraft(EMPTY_OPS_FILTERS);
    onApply(EMPTY_OPS_FILTERS);
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
        <FilterField label="종류">
          <Select
            aria-label="종류"
            options={KIND_OPTIONS}
            value={draft.kind ?? ALL}
            onValueChange={(value) =>
              update({
                kind: RISK_EVENT_KINDS.find((kind) => kind === value) ?? null,
              })
            }
          />
        </FilterField>
      </FilterPanel>
      <FilterActions onReset={handleReset} onApply={() => onApply(draft)} />
    </form>
  );
}
