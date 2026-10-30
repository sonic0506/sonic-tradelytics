import { Suspense } from 'react';

import { BotSettingsContent } from './bot-settings-content';
import { BotSettingsSkeleton } from './bot-settings-skeleton';

export function BotSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<BotSettingsSkeleton />}>
      <BotSettingsContent params={params} />
    </Suspense>
  );
}
