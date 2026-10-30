import { useSuspenseQuery } from '@tanstack/react-query';

import { botQueries } from '../api/bot.queries';
import type { GetVersionPreview } from '../model/bot-version.schema';

export function useVersionPreviewQuery(params: GetVersionPreview) {
  return useSuspenseQuery(botQueries.versionPreview(params));
}
