import { Separator } from '@xonic0506/sonic-ui';
import { Check } from 'lucide-react';

const STEPS = ['유형·성향', '자금·기간', '규칙 값', '안전장치'];

type StepState = 'done' | 'current' | 'upcoming';

// Figma Create / StepItem: done은 check, current는 bg/primary 원, upcoming은 border/strong 원
const DOT_CLASS: Record<StepState, string> = {
  done: 'bg-success-subtle text-success',
  current: 'bg-primary text-on-primary',
  upcoming: 'border border-strong text-muted',
};

const LABEL_CLASS: Record<StepState, string> = {
  done: 'text-body text-default',
  current: 'text-body-strong text-default',
  upcoming: 'text-body text-muted',
};

// 좁은 화면: "2/4 자금·기간"과 진행 막대 (Figma Bot Create — Mobile)
function CompactStepper({ current }: { current: number }) {
  return (
    <div className="flex flex-col gap-2 sm:hidden">
      <p className="text-label text-default">
        {current}/{STEPS.length} {STEPS[current - 1]}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(current / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CreateStepper({ current }: { current: number }) {
  return (
    <>
      <CompactStepper current={current} />
      <FullStepper current={current} />
    </>
  );
}

function FullStepper({ current }: { current: number }) {
  return (
    <ol
      aria-label="봇 만들기 단계"
      className="flex items-center gap-3 max-sm:hidden"
    >
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state: StepState =
          number < current
            ? 'done'
            : number === current
              ? 'current'
              : 'upcoming';
        return (
          <li
            key={label}
            className={`flex items-center gap-3 ${index > 0 ? 'flex-1' : ''}`}
          >
            {index > 0 && <Separator className="w-auto flex-1" />}
            <span
              className="flex shrink-0 items-center gap-2"
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-label ${DOT_CLASS[state]}`}
              >
                {state === 'done' ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  number
                )}
              </span>
              <span className={LABEL_CLASS[state]}>
                {label}
                {state === 'done' && <span className="sr-only"> (완료)</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
