'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants, useToast } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useState } from 'react';

import { allocationQueries } from '@/entities/allocation';
import { type BotDefaults, botQueries } from '@/entities/bot';
import {
  applyDefaults,
  type BotDraft,
  describeCreateBotError,
  type DraftErrors,
  getRatioExceededError,
  INITIAL_DRAFT,
  toAllocationPreviewParams,
  toCreateBot,
  useCreateBotMutation,
  validateDraftStep,
} from '@/features/bot/create-bot';
import { toTradeDate } from '@/shared/lib';

import { CreateStepper } from './create-stepper';
import { FundsStep } from './funds-step';
import { RulesStep } from './rules-step';
import { SafetyStep } from './safety-step';
import { TypeStep } from './type-step';

const LAST_STEP = 4;

// 기본값은 받아 온 유형·성향과 함께 들고 있어요. 1단계에서 둘 중 하나를 바꾸면 다시 받아요.
type LoadedDefaults = { key: string; value: BotDefaults };

const defaultsKey = (draft: BotDraft) => `${draft.type}:${draft.riskProfile}`;

function omitKeys(errors: DraftErrors, keys: string[]): DraftErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => !keys.includes(key)),
  );
}

// 봇 만들기 4단계 (F1, Figma Bot Create). 입력은 화면 안에만 두고 마지막에 한 번에 저장해요.
export function BotCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const createBot = useCreateBotMutation();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BotDraft>(INITIAL_DRAFT);
  const [defaults, setDefaults] = useState<LoadedDefaults | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isChecking, setIsChecking] = useState(false);
  const ruleFields = defaults?.value.rules ?? [];

  const goToStep = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const handleDraftChange = (patch: Partial<BotDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => omitKeys(prev, Object.keys(patch)));
  };
  const handleRuleChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
    setErrors((prev) => omitKeys(prev, [`rule.${key}`]));
  };
  const handleRulesReset = () => {
    if (!defaults) return;
    setDraft((prev) => ({
      ...prev,
      rules: Object.fromEntries(
        defaults.value.rules.map((field) => [field.key, String(field.value)]),
      ),
    }));
    setErrors({});
  };

  // 1 → 2: 유형·성향 기본값으로 나머지 단계를 채워요.
  const loadDefaults = async () => {
    const key = defaultsKey(draft);
    if (defaults?.key === key) return true;
    try {
      const value = await queryClient.query(
        botQueries.defaults({
          type: draft.type,
          riskProfile: draft.riskProfile,
        }),
      );
      setDefaults({ key, value });
      setDraft((prev) => applyDefaults(prev, value, toTradeDate(new Date())));
      return true;
    } catch {
      toast.add({
        tone: 'danger',
        title: '기본값을 불러오지 못했어요',
        description: '잠시 뒤 다시 시도해 주세요.',
      });
      return false;
    }
  };

  // 2 → 3: 같은 시각에 시작하는 정률 합이 100%를 넘으면 넘어가지 않아요 (POL-FUND-03)
  const checkRatioTotal = async () => {
    if (draft.budgetType !== 'ratio') return true;
    try {
      const preview = await queryClient.query(
        allocationQueries.preview(toAllocationPreviewParams(draft)),
      );
      const error = getRatioExceededError(
        preview.ratioTotal,
        Number(draft.budgetValue),
      );
      if (error) setErrors({ budgetValue: error });
      return error === null;
    } catch {
      // 미리보기를 못 받아도 저장할 때 서버가 다시 확인해요.
      return true;
    }
  };

  const submit = () => {
    createBot.mutate(toCreateBot(draft, ruleFields), {
      onSuccess: ({ id }) => {
        toast.add({
          tone: 'success',
          title: '봇을 만들었어요',
          description: '운용 기간 첫날 운영 시작 시각에 시작해요.',
        });
        router.push(`/bots/${encodeURIComponent(id)}`);
      },
      onError: (error) => {
        const failure = describeCreateBotError(error);
        toast.add({
          tone: 'danger',
          title: '봇을 만들지 못했어요',
          description: failure.message,
        });
        if (failure.step !== null) {
          setErrors(failure.errors);
          goToStep(failure.step);
        }
      },
    });
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const stepErrors = validateDraftStep(step, draft, ruleFields);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    if (step === LAST_STEP) {
      submit();
      return;
    }
    setIsChecking(true);
    const canContinue =
      step === 1
        ? await loadDefaults()
        : step === 2
          ? await checkRatioTotal()
          : true;
    setIsChecking(false);
    if (canContinue) goToStep(step + 1);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-6"
    >
      <CreateStepper current={step} />
      {step === 1 && (
        <TypeStep draft={draft} errors={errors} onChange={handleDraftChange} />
      )}
      {step === 2 && (
        <FundsStep draft={draft} errors={errors} onChange={handleDraftChange} />
      )}
      {step === 3 && (
        <RulesStep
          draft={draft}
          fields={ruleFields}
          errors={errors}
          onRuleChange={handleRuleChange}
          onReset={handleRulesReset}
        />
      )}
      {step === LAST_STEP && defaults && (
        <SafetyStep
          draft={draft}
          defaults={defaults.value}
          errors={errors}
          onChange={handleDraftChange}
        />
      )}
      <div className="flex items-center gap-2">
        {/* 좁은 화면은 위의 "봇 목록"으로 나가고, 버튼을 전체 너비로 둬요 (Figma Bot Create — Mobile) */}
        <NextLink
          href="/bots"
          className={`${buttonVariants({ variant: 'ghost' })} max-sm:hidden`}
        >
          취소
        </NextLink>
        <span className="flex-1 max-sm:hidden" />
        {step > 1 && (
          <Button
            type="button"
            variant="secondary"
            className="border-default max-sm:h-10 max-sm:flex-1"
            onClick={() => goToStep(step - 1)}
          >
            이전
          </Button>
        )}
        <Button
          type="submit"
          className="max-sm:h-10 max-sm:flex-2"
          loading={isChecking || createBot.isPending}
        >
          {step === LAST_STEP ? '봇 만들기' : '다음'}
        </Button>
      </div>
    </form>
  );
}
