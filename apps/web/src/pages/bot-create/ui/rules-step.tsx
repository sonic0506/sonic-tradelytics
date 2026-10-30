'use client';

import {
  Button,
  Card,
  Field,
  Input,
  Separator,
  Text,
} from '@xonic0506/sonic-ui';

import {
  BOT_TYPE_LABEL,
  RISK_PROFILE_LABEL,
  type RuleField,
} from '@/entities/bot';
import type { BotDraft, DraftErrors } from '@/features/bot/create-bot';

import { formatRuleValue, isRuleChanged } from '../lib/bot-create-copy';

const GROUPS: { key: RuleField['group']; title: string }[] = [
  { key: 'filter', title: '종목 필터' },
  { key: 'entry', title: '진입 조건' },
  { key: 'exit', title: '청산 조건' },
];

type RuleInputProps = {
  field: RuleField;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
};

function RuleInput({ field, value, error, onChange }: RuleInputProps) {
  const defaultText = formatRuleValue(field, String(field.value));
  const hasChanged = isRuleChanged(field, value);
  const unit = field.unit ? ` (${field.unit})` : '';
  const isTime = field.kind === 'time';
  return (
    <Field
      label={`${field.label}${unit}${hasChanged ? ' · 바꾼 값' : ''}`}
      description={
        hasChanged
          ? `기본값 ${defaultText}에서 바꿨어요.`
          : `기본값 ${defaultText}`
      }
      error={error}
      invalid={Boolean(error)}
    >
      <Input
        type={isTime ? 'time' : 'number'}
        {...(isTime ? {} : { step: 'any', inputMode: 'decimal' as const })}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

type RulesStepProps = {
  draft: BotDraft;
  fields: RuleField[];
  errors: DraftErrors;
  onRuleChange: (key: string, value: string) => void;
  onReset: () => void;
};

// 3단계: 유형별 규칙 값. 기본값 옆에 바꾼 값을 표시해요 (Figma Bot Create / 3 규칙 값)
export function RulesStep({
  draft,
  fields,
  errors,
  onRuleChange,
  onReset,
}: RulesStepProps) {
  const hasChanges = fields.some((field) =>
    isRuleChanged(field, draft.rules[field.key] ?? ''),
  );
  const groups = GROUPS.map((group) => ({
    ...group,
    fields: fields.filter((field) => field.group === group.key),
  })).filter((group) => group.fields.length > 0);

  return (
    <Card className="gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Text as="h2" variant="title">
            규칙 값
          </Text>
          <Text as="p" tone="muted">
            {BOT_TYPE_LABEL[draft.type]} ·{' '}
            {RISK_PROFILE_LABEL[draft.riskProfile]} 기본값을 넣었어요. 숫자만
            바꿀 수 있어요.
          </Text>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasChanges}
          onClick={onReset}
        >
          모두 기본값으로
        </Button>
      </div>
      {groups.map((group, index) => (
        <section key={group.key} className="flex flex-col gap-4">
          {index > 0 && <Separator />}
          <Text as="h3" variant="body-strong">
            {group.title}
          </Text>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <RuleInput
                key={field.key}
                field={field}
                value={draft.rules[field.key] ?? ''}
                error={errors[`rule.${field.key}`]}
                onChange={(value) => onRuleChange(field.key, value)}
              />
            ))}
          </div>
        </section>
      ))}
    </Card>
  );
}
