'use client';

import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Radio,
  RadioGroup,
  Select,
  Text,
  useToast,
} from '@xonic0506/sonic-ui';
import { type SubmitEvent, useState } from 'react';

import type { BotDetailView } from '@/entities/bot';
import {
  type BasicSettingsDraft,
  type BasicSettingsErrors,
  useUpdateBotSettingsMutation,
  validateBasicSettings,
} from '@/features/bot/update-bot-settings';
import { toTradeDate } from '@/shared/lib';

import { SectionHeader } from './section-header';

const PRIORITY_OPTIONS = [1, 2, 3, 4, 5].map((order) => ({
  value: String(order),
  label: `${order}번째`,
}));

function toDraft(bot: BotDetailView): BasicSettingsDraft {
  return {
    name: bot.name,
    periodEnd: bot.settings.periodEnd ?? '',
    isIndefinite: bot.settings.periodEnd === null,
    onPeriodEnd: bot.settings.onPeriodEnd,
    startPriority:
      bot.settings.startPriority === null
        ? null
        : String(bot.settings.startPriority),
    tradingStart: bot.tradingHours.start,
    tradingEnd: bot.tradingHours.end,
  };
}

// 판단에 쓰이지 않는 설정 (Figma Card / 기본 설정, api.md PATCH)
export function BasicSettingsCard({ bot }: { bot: BotDetailView }) {
  const toast = useToast();
  const update = useUpdateBotSettingsMutation();
  const [draft, setDraft] = useState(() => toDraft(bot));
  const [errors, setErrors] = useState<BasicSettingsErrors>({});
  const isRatio = bot.budgetSetting.type === 'ratio';

  const handleChange = (patch: Partial<BasicSettingsDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => !(key in patch)),
      ),
    );
  };
  const handleReset = () => {
    setDraft(toDraft(bot));
    setErrors({});
  };
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateBasicSettings(draft, toTradeDate(new Date()));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    update.mutate(
      {
        botId: bot.id,
        name: draft.name.trim(),
        periodEnd: draft.isIndefinite ? null : draft.periodEnd,
        onPeriodEnd: draft.onPeriodEnd,
        startPriority: isRatio ? null : Number(draft.startPriority ?? 1),
        tradingHours: { start: draft.tradingStart, end: draft.tradingEnd },
      },
      {
        onSuccess: () =>
          toast.add({
            tone: 'success',
            title: '기본 설정을 저장했어요',
            description: '엔진이 다음 주기부터 반영해요.',
          }),
        onError: () =>
          toast.add({
            tone: 'danger',
            title: '기본 설정을 저장하지 못했어요',
            description: '잠시 뒤 다시 시도해 주세요.',
          }),
      },
    );
  };
  const fieldError = (key: keyof BasicSettingsErrors) => ({
    error: errors[key],
    invalid: Boolean(errors[key]),
  });

  return (
    <Card className="gap-6 p-6">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="기본 설정"
            description="판단에 쓰이지 않는 값이에요. 저장하면 다음 주기부터 반영해요."
          />
          <Field
            label="봇 이름"
            description="목록과 알림에 보여요."
            {...fieldError('name')}
          >
            <Input
              value={draft.name}
              maxLength={30}
              onChange={(event) => handleChange({ name: event.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="운용 종료일"
              disabled={draft.isIndefinite}
              {...fieldError('periodEnd')}
            >
              <Input
                type="date"
                value={draft.periodEnd}
                onChange={(event) =>
                  handleChange({ periodEnd: event.target.value })
                }
              />
            </Field>
            <Field
              label="시작 우선순위"
              description={
                isRatio
                  ? '정액 봇에만 써요.'
                  : '자금이 모자라면 앞 순서부터 확정해요.'
              }
            >
              <Select
                options={PRIORITY_OPTIONS}
                value={isRatio ? null : draft.startPriority}
                onValueChange={(value) =>
                  handleChange({ startPriority: value })
                }
                placeholder={isRatio ? '정률은 먼저 확정돼요' : '순서 선택'}
                disabled={isRatio}
              />
            </Field>
          </div>
          <Checkbox
            checked={draft.isIndefinite}
            onCheckedChange={(isIndefinite) =>
              handleChange({ isIndefinite, periodEnd: '' })
            }
          >
            종료일 없이 계속 운용
          </Checkbox>
          <RadioGroup
            label="종료일에 들고 있는 종목"
            value={draft.onPeriodEnd}
            onValueChange={(value) =>
              handleChange({
                onPeriodEnd: value === 'hold' ? 'hold' : 'liquidate',
              })
            }
            disabled={draft.isIndefinite}
            className="[&_[role=radiogroup]]:flex-row [&_[role=radiogroup]]:gap-4"
          >
            <Radio value="liquidate">모두 팔기</Radio>
            <Radio value="hold">그대로 두기</Radio>
          </RadioGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="운영 시작" {...fieldError('tradingStart')}>
              <Input
                type="time"
                value={draft.tradingStart}
                onChange={(event) =>
                  handleChange({ tradingStart: event.target.value })
                }
              />
            </Field>
            <Field label="운영 종료" {...fieldError('tradingEnd')}>
              <Input
                type="time"
                value={draft.tradingEnd}
                onChange={(event) =>
                  handleChange({ tradingEnd: event.target.value })
                }
              />
            </Field>
          </div>
          <Text as="p" variant="caption" tone="muted">
            운영 시간은 정규장 09:00~15:30 안에서 정해요.
          </Text>
        </section>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="border-default"
            onClick={handleReset}
          >
            취소
          </Button>
          <Button type="submit" loading={update.isPending}>
            저장
          </Button>
        </div>
      </form>
    </Card>
  );
}
