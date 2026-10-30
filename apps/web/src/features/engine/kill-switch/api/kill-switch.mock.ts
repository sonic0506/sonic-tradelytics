import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

export const killSwitchHandlers = [
  http.post(mockApiUrl('/v1/commands'), () =>
    HttpResponse.json(
      { id: 'cmd-1', kind: 'kill', handledAt: null },
      { status: 201 },
    ),
  ),
];
