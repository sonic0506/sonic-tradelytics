import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

export const createBotHandlers = [
  http.post(mockApiUrl('/v1/bots'), () =>
    HttpResponse.json({ id: 'bot-new' }, { status: 201 }),
  ),
];
