import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import { formatRuleValue } from '../lib/rule-format';
import type {
  BotVersion,
  RuleParams,
  VersionPreview,
} from '../model/bot-version.schema';
import { BOT_DETAILS_FIXTURE } from './bot-detail.mock';

// 줄이기만 하면 위험만 줄이는 변경이에요 (api.md 규칙 값 버전)
const RISK_ONLY_KEYS = new Set([
  'firstLossPct',
  'totalLossPct',
  'stopStreak',
  'orderAmount',
]);

function getVersions(botId: string): BotVersion[] {
  const bot = BOT_DETAILS_FIXTURE.find((item) => item.id === botId);
  if (!bot) return [];
  return Array.from({ length: bot.version }, (_, index) => ({
    version: index + 1,
    changeKind: index === 0 ? 'initial' : 'decision_change',
    changes: [],
    createdAt: '2026-10-01T14:52:00+09:00',
    appliedAt: '2026-10-01T15:10:00+09:00',
  }));
}

export const botVersionHandlers = [
  http.get(mockApiUrl('/v1/bots/:id/versions'), ({ params }) =>
    HttpResponse.json({ items: getVersions(String(params.id)) }),
  ),
  http.post(
    mockApiUrl('/v1/bots/:id/version-previews'),
    async ({ params, request }) => {
      const bot = BOT_DETAILS_FIXTURE.find((item) => item.id === params.id);
      if (!bot) {
        return HttpResponse.json({ code: 'BOT_NOT_FOUND' }, { status: 404 });
      }
      const body = (await request.json()) as { params: RuleParams };
      let isRiskOnly = true;
      const changes = bot.ruleVersion.fields.flatMap((field) => {
        const next = String(body.params[field.key] ?? '');
        const current = String(field.value);
        const isSame =
          field.kind === 'number'
            ? Number(next) === Number(current)
            : next === current;
        if (isSame) return [];
        const isSmaller = Math.abs(Number(next)) < Math.abs(Number(current));
        if (!RISK_ONLY_KEYS.has(field.key) || !isSmaller) isRiskOnly = false;
        return [
          {
            label: field.label,
            from: formatRuleValue(field, current),
            to: formatRuleValue(field, next),
          },
        ];
      });
      const changeKind =
        changes.length === 0
          ? null
          : isRiskOnly
            ? 'risk_only'
            : 'decision_change';
      const preview: VersionPreview = {
        changeKind,
        applyTiming: bot.resting ? 'now' : 'when_resting',
        reconfirmsAtCap:
          changeKind === 'decision_change' && bot.stage === 'verifying',
        changes,
      };
      return HttpResponse.json(preview);
    },
  ),
  http.post(mockApiUrl('/v1/bots/:id/versions'), ({ params }) => {
    const bot = BOT_DETAILS_FIXTURE.find((item) => item.id === params.id);
    return HttpResponse.json(
      { version: (bot?.version ?? 0) + 1 },
      { status: 201 },
    );
  }),
  http.patch(mockApiUrl('/v1/bots/:id'), ({ params }) =>
    HttpResponse.json({ id: params.id }),
  ),
];
