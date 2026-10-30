'use client';

import { Input, Select } from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import { BOT_STAGE_LABEL, BOT_STATUS_LABEL } from '@/entities/bot';
import { botStageSchema, botStatusSchema } from '@/shared/api';
import {
  FilterActions,
  FilterField,
  FilterPanel,
  QueryBoundary,
} from '@/shared/ui';

import {
  type BotListFilters,
  type BotSortKey,
  getNextSort,
  type SortDirection,
} from '../lib/bot-list-order';
import { useBotListSearchParams } from '../model/use-bot-list-search-params';
import { BotResults, BotResultsSkeleton } from './bot-results';

const ALL = 'all';
const STATUS_OPTIONS = [
  { value: ALL, label: '전체' },
  ...botStatusSchema.options.map((status) => ({
    value: status,
    label: BOT_STATUS_LABEL[status],
  })),
];
const STAGE_OPTIONS = [
  { value: ALL, label: '전체' },
  ...botStageSchema.options.map((stage) => ({
    value: stage,
    label: BOT_STAGE_LABEL[stage],
  })),
];

const EMPTY_FILTERS: BotListFilters = { q: '', status: null, stage: null };

type BotListFilterFormProps = {
  draft: BotListFilters;
  onDraftChange: (draft: BotListFilters) => void;
  onApply: () => void;
  onReset: () => void;
};

// 봇 이름·상태·단계 필터와 초기화·조회하기
function BotListFilterForm({
  draft,
  onDraftChange,
  onApply,
  onReset,
}: BotListFilterFormProps) {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply();
  };
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FilterPanel>
        <FilterField label="봇 이름">
          <Input
            aria-label="봇 이름"
            placeholder="입력"
            value={draft.q}
            onChange={(event) =>
              onDraftChange({ ...draft, q: event.target.value })
            }
          />
        </FilterField>
        <FilterField label="상태">
          <Select
            aria-label="상태"
            options={STATUS_OPTIONS}
            value={draft.status ?? ALL}
            onValueChange={(value) =>
              onDraftChange({
                ...draft,
                status: botStatusSchema.safeParse(value).data ?? null,
              })
            }
          />
        </FilterField>
        <FilterField label="단계">
          <Select
            aria-label="단계"
            options={STAGE_OPTIONS}
            value={draft.stage ?? ALL}
            onValueChange={(value) =>
              onDraftChange({
                ...draft,
                stage: botStageSchema.safeParse(value).data ?? null,
              })
            }
          />
        </FilterField>
      </FilterPanel>
      <FilterActions onReset={onReset} onApply={onApply} />
    </form>
  );
}

// 필터는 고르는 동안 화면 안에만 두고, 조회하기를 누르면 URL에 반영해요(Figma App / FilterActions).
export function BotListContent() {
  const [params, setParams] = useBotListSearchParams();
  const applied: BotListFilters = {
    q: params.q,
    status: params.status,
    stage: params.stage,
  };
  const [draft, setDraft] = useState<BotListFilters>(applied);
  const sort = { key: params.sort, direction: params.dir };

  const handleApply = () => {
    void setParams({
      q: draft.q.trim(),
      status: draft.status,
      stage: draft.stage,
    });
  };
  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    void setParams(EMPTY_FILTERS);
  };
  const handleSortChange = (next: {
    key: BotSortKey;
    direction: SortDirection;
  }) => {
    void setParams({ sort: next.key, dir: next.direction });
  };

  return (
    <div className="flex flex-col gap-4">
      <BotListFilterForm
        draft={draft}
        onDraftChange={setDraft}
        onApply={handleApply}
        onReset={handleReset}
      />
      <QueryBoundary
        loading={<BotResultsSkeleton />}
        errorTitle="봇 목록을 불러오지 못했어요"
        errorDescription="네트워크 연결을 확인하고 다시 시도해 주세요."
        isErrorInCard
      >
        <BotResults
          filters={applied}
          sort={sort}
          onSort={(key) => handleSortChange(getNextSort(sort, key))}
          onSortChange={handleSortChange}
          onResetFilters={handleReset}
        />
      </QueryBoundary>
    </div>
  );
}

const ignore = () => undefined;

// 목록을 처음 받는 동안: 필터는 그대로 보여 주고 목록 자리만 Skeleton이에요(Figma Bot List — 로딩).
export function BotListContentSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <BotListFilterForm
        draft={EMPTY_FILTERS}
        onDraftChange={ignore}
        onApply={ignore}
        onReset={ignore}
      />
      <BotResultsSkeleton />
    </div>
  );
}
