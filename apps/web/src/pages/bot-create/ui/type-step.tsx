'use client';

import {
  Badge,
  Card,
  Field,
  Input,
  Radio,
  RadioGroup,
  Separator,
  Text,
} from '@xonic0506/sonic-ui';
import { TriangleAlert } from 'lucide-react';

import {
  BOT_TYPE_LABEL,
  BotCharacter,
  IS_CARRY_OVER,
  LOSS_SCOPE_LABEL,
  LOSS_STOP_PRESET,
  RISK_PROFILE_LABEL,
  type RiskProfile,
} from '@/entities/bot';
import type { BotDraft, DraftErrors } from '@/features/bot/create-bot';
import type { BotType } from '@/shared/api';

import { GAP_RISK_NOTICE, TYPE_DESCRIPTION } from '../lib/bot-create-copy';
import { SectionHeader } from './section-header';

const TYPES: BotType[] = ['scalping', 'day', 'swing', 'closing'];
const RISK_PROFILES: RiskProfile[] = ['aggressive', 'neutral', 'conservative'];

type StepProps = {
  draft: BotDraft;
  errors: DraftErrors;
  onChange: (patch: Partial<BotDraft>) => void;
};

type TypeOptionProps = {
  type: BotType;
  isSelected: boolean;
  onSelect: () => void;
};

// 봇 유형 카드 (Figma Create / TypeOption). 카드 모양 radio예요.
function TypeOption({ type, isSelected, onSelect }: TypeOptionProps) {
  const isCarryOver = IS_CARRY_OVER[type];
  return (
    <label
      className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
        isSelected
          ? 'border-focus bg-selected outline-1 -outline-offset-2 outline-focus'
          : 'border-default bg-surface hover:border-strong'
      }`}
    >
      <input
        type="radio"
        name="bot-type"
        value={type}
        checked={isSelected}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-center justify-between gap-2">
        <BotCharacter type={type} />
        <Badge tone={isCarryOver ? 'warning' : 'neutral'}>
          {isCarryOver ? '이월' : '당일 청산'}
        </Badge>
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-body-strong text-default">
          {BOT_TYPE_LABEL[type]}
        </span>
        <span className="text-caption text-muted">
          {TYPE_DESCRIPTION[type]}
        </span>
      </span>
    </label>
  );
}

function GapRiskNotice({ type }: { type: BotType }) {
  const notice = GAP_RISK_NOTICE[type];
  if (!notice) return null;
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-warning bg-warning-subtle p-3"
    >
      <span className="flex h-5 items-center">
        <TriangleAlert className="size-4 text-warning" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <Text as="p" variant="body-strong" className="text-warning">
          밤사이 갭 하락 위험이 있어요
        </Text>
        <Text as="p" variant="caption">
          {notice}
        </Text>
      </div>
    </div>
  );
}

// 1단계: 유형·성향·이름 (Figma Bot Create / 1 유형)
export function TypeStep({ draft, errors, onChange }: StepProps) {
  const handleProfileChange = (value: string) => {
    const riskProfile = RISK_PROFILES.find((profile) => profile === value);
    if (riskProfile) onChange({ riskProfile });
  };
  const scope = LOSS_SCOPE_LABEL[draft.type];

  return (
    <Card className="gap-6 p-6">
      <section className="flex flex-col gap-3">
        <SectionHeader
          id="bot-type-title"
          title="봇 유형"
          description="유형을 고르면 규칙 값과 안전장치의 기본값을 채워요."
        />
        <div
          role="radiogroup"
          aria-labelledby="bot-type-title"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {TYPES.map((type) => (
            <TypeOption
              key={type}
              type={type}
              isSelected={draft.type === type}
              onSelect={() => onChange({ type })}
            />
          ))}
        </div>
        <GapRiskNotice type={draft.type} />
      </section>
      <Separator />
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="투자 성향"
          description="손실 중지 기준, 1회 주문 비중, 동시 보유 종목 수의 기본값이 바뀌어요."
        />
        <RadioGroup
          label={<span className="sr-only">투자 성향</span>}
          value={draft.riskProfile}
          onValueChange={handleProfileChange}
          className="[&_[role=radiogroup]]:grid [&_[role=radiogroup]]:gap-3 sm:[&_[role=radiogroup]]:grid-cols-3"
        >
          {RISK_PROFILES.map((profile) => {
            const preset = LOSS_STOP_PRESET[draft.type][profile];
            return (
              <Radio
                key={profile}
                value={profile}
                className="items-start rounded-md border border-default p-4"
              >
                <span className="flex flex-col gap-1">
                  <span>{RISK_PROFILE_LABEL[profile]}</span>
                  <span className="text-caption text-muted">
                    {scope} −{preset.first}% · 누적 −{preset.total}%
                  </span>
                </span>
              </Radio>
            );
          })}
        </RadioGroup>
      </section>
      <Separator />
      <Field
        label="봇 이름"
        description="목록과 알림에 보여요."
        error={errors.name}
        invalid={Boolean(errors.name)}
      >
        <Input
          value={draft.name}
          placeholder="예: 종가 베팅 B"
          maxLength={30}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>
    </Card>
  );
}
