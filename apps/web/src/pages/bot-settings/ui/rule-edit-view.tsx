'use client';

import {
  buttonVariants,
  Card,
  EmptyState,
  Field,
  Input,
  Separator,
  Text,
  useToast,
} from '@xonic0506/sonic-ui';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useState } from 'react';

import {
  formatRuleValue,
  getRuleValueError,
  isRuleChanged,
  type RuleField,
  toRuleParams,
  useBotQuery,
} from '@/entities/bot';
import { useSaveRuleVersionMutation } from '@/features/bot/save-rule-version';
import { HttpError } from '@/shared/api';
import { QueryBoundary } from '@/shared/ui';

import { BackLink } from './back-link';
import {
  RuleEditPreviewCard,
  RuleEditPreviewCardSkeleton,
} from './rule-edit-preview-card';

// 진입과 청산은 한 묶음으로 보여 줘요 (Figma 규칙 값 바꾸기)
const GROUPS: { title: string; groups: RuleField['group'][] }[] = [
  { title: '종목 필터', groups: ['filter'] },
  { title: '진입·청산', groups: ['entry', 'exit'] },
  { title: '안전장치', groups: ['safety'] },
];

function getSaveFailureText(error: Error) {
  const code = error instanceof HttpError ? error.code : null;
  if (code === 'BOT_VERSION_PENDING') {
    return '적용을 기다리는 버전이 있어요. 적용된 뒤에 다시 저장해 주세요.';
  }
  if (code === 'VALIDATION_FAILED') return '규칙 값을 확인해 주세요.';
  return '잠시 뒤 다시 시도해 주세요.';
}

// 규칙 값 바꾸기 (FR-BOT-03, 11, Figma Bot Settings / 규칙 값 바꾸기)
export function RuleEditView({ botId }: { botId: string }) {
  const router = useRouter();
  const toast = useToast();
  const save = useSaveRuleVersionMutation();
  const { data: bot } = useBotQuery(botId);
  const { fields, version } = bot.ruleVersion;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, String(field.value)])),
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const settingsHref = `/bots/${encodeURIComponent(bot.id)}/settings`;
  const params = toRuleParams(fields, values);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
    const hasError = fields.some(
      (field) => getRuleValueError(field, values[field.key] ?? '') !== null,
    );
    if (hasError) return;
    save.mutate(
      { botId: bot.id, params },
      {
        onSuccess: ({ version: saved }) => {
          toast.add({
            tone: 'success',
            title: `규칙 값을 v${saved}로 저장했어요`,
            description: bot.resting
              ? '쉬는 중이라 바로 적용해요.'
              : '쉬는 중이 되면 적용해요.',
          });
          router.push(settingsHref);
        },
        onError: (error) =>
          toast.add({
            tone: 'danger',
            title: '규칙 값을 저장하지 못했어요',
            description: getSaveFailureText(error),
          }),
      },
    );
  };

  const header = (
    <>
      <BackLink href={settingsHref} label="봇 설정" />
      <header className="flex flex-col gap-1">
        <Text as="h1" variant="display">
          규칙 값 바꾸기
        </Text>
        <Text as="p" tone="muted">
          {bot.name} · v{version} → v{version + 1} · 숫자만 바꿀 수 있어요.
        </Text>
      </header>
    </>
  );

  if (bot.pendingVersion !== null) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <EmptyState
            title={`v${bot.pendingVersion}를 적용 대기 중이에요`}
            description="적용을 기다리는 버전이 있으면 새로 바꿀 수 없어요. 적용된 뒤에 다시 바꿔 주세요."
            action={
              <NextLink href={settingsHref} className={buttonVariants()}>
                봇 설정으로 가기
              </NextLink>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {header}
      <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-4">
        <Card className="gap-6 p-6 lg:col-span-2">
          {GROUPS.map((group, index) => {
            const groupFields = fields.filter((field) =>
              group.groups.includes(field.group),
            );
            if (groupFields.length === 0) return null;
            return (
              <section key={group.title} className="flex flex-col gap-4">
                {index > 0 && <Separator />}
                <Text as="h2" variant="body-strong">
                  {group.title}
                </Text>
                <div className="grid gap-4 sm:grid-cols-2">
                  {groupFields.map((field) => {
                    const text = values[field.key] ?? '';
                    const hasChanged = isRuleChanged(field, text);
                    const base = formatRuleValue(field, String(field.value));
                    const error = getRuleValueError(field, text);
                    const isTime = field.kind === 'time';
                    return (
                      <Field
                        key={field.key}
                        label={`${field.label}${field.unit ? ` (${field.unit})` : ''}${hasChanged ? ' · 바뀜' : ''}`}
                        description={
                          hasChanged
                            ? `v${version} 값 ${base}에서 바뀌었어요.`
                            : `v${version} 값 ${base}`
                        }
                        error={error ?? ''}
                        invalid={isSubmitted && error !== null}
                      >
                        <Input
                          type={isTime ? 'time' : 'number'}
                          {...(isTime
                            ? {}
                            : { step: 'any', inputMode: 'decimal' as const })}
                          value={text}
                          onChange={(event) =>
                            setValues((prev) => ({
                              ...prev,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </Card>
        <QueryBoundary
          loading={<RuleEditPreviewCardSkeleton />}
          errorTitle="저장 결과를 미리 보지 못했어요"
          isCompact
          isErrorInCard
        >
          <RuleEditPreviewCard
            bot={bot}
            params={{ botId: bot.id, params }}
            isSaving={save.isPending}
          />
        </QueryBoundary>
      </div>
    </form>
  );
}
