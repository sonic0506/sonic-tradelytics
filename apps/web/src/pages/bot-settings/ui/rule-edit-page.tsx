import { Suspense } from 'react';

import { BotSettingsSkeleton } from './bot-settings-skeleton';
import { RuleEditContent } from './rule-edit-content';

export function RuleEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BotSettingsSkeleton />}>
      <RuleEditContent params={params} />
    </Suspense>
  );
}
