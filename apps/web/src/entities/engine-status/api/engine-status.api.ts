import { http } from '@/shared/api';

import { engineStatusSchema } from '../model/engine-status.schema';

export async function getEngineStatus() {
  return engineStatusSchema.parse(await http<unknown>('/v1/engine-status'));
}
