import { http } from '@/shared/api';

import { commandSchema, type CreateKillCommand } from '../model/command.schema';

export async function createKillCommand({ liquidateAll }: CreateKillCommand) {
  return commandSchema.parse(
    await http<unknown>('/v1/commands', {
      method: 'POST',
      body: JSON.stringify({ kind: 'kill', liquidateAll }),
    }),
  );
}
