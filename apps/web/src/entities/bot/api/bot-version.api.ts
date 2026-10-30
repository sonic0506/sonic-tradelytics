import { http } from '@/shared/api';

import {
  botVersionsSchema,
  type GetVersionPreview,
  versionPreviewSchema,
} from '../model/bot-version.schema';

export async function getBotVersions(botId: string) {
  return botVersionsSchema.parse(
    await http<unknown>(`/v1/bots/${encodeURIComponent(botId)}/versions`),
  );
}

// 저장하지 않고 계산만 해요(200)
export async function getVersionPreview({ botId, params }: GetVersionPreview) {
  return versionPreviewSchema.parse(
    await http<unknown>(
      `/v1/bots/${encodeURIComponent(botId)}/version-previews`,
      { method: 'POST', body: JSON.stringify({ params }) },
    ),
  );
}
