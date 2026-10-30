import { z } from 'zod';

// 규칙 값 버전의 변경 종류 (FR-BOT-03, 11). decision_change면 검증 구간을 다시 시작해요
export const versionChangeKindSchema = z.enum([
  'initial',
  'decision_change',
  'risk_only',
]);
export type VersionChangeKind = z.infer<typeof versionChangeKindSchema>;

// 바뀐 값 한 줄. 이름과 표시 값은 유형별 규칙을 아는 서버가 만들어요
const ruleChangeSchema = z.object({
  label: z.string(),
  from: z.string(),
  to: z.string(),
});
export type RuleChange = z.infer<typeof ruleChangeSchema>;

// GET /v1/bots/:id/versions
export const botVersionsSchema = z.object({
  items: z.array(
    z.object({
      version: z.number().int(),
      changeKind: versionChangeKindSchema,
      changes: z.array(ruleChangeSchema),
      createdAt: z.string(),
      // 적용 대기면 null (POL-RISK-13)
      appliedAt: z.string().nullable(),
    }),
  ),
});
export type BotVersion = z.infer<typeof botVersionsSchema>['items'][number];

// 규칙 값 키 → 값. 숫자 규칙은 number, 시각은 "HH:MM"
export type RuleParams = Record<string, number | string>;

export type GetVersionPreview = { botId: string; params: RuleParams };

// POST /v1/bots/:id/version-previews: 저장하면 어떻게 되는지 (FR-BOT-11)
export const versionPreviewSchema = z.object({
  // 바뀐 값이 없으면 null
  changeKind: z.enum(['decision_change', 'risk_only']).nullable(),
  // now 쉬는 중이라 바로 · when_resting 쉬는 중이 된 뒤
  applyTiming: z.enum(['now', 'when_resting']),
  // 적용할 때 투자금을 검증 상한으로 다시 확정하는지
  reconfirmsAtCap: z.boolean(),
  changes: z.array(ruleChangeSchema),
});
export type VersionPreview = z.infer<typeof versionPreviewSchema>;
