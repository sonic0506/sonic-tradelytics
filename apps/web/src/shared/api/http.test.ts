import { describe, expect, it } from 'vitest';

import { holdRequests, http, releaseRequests } from './http';

describe('http', () => {
  it('붙잡아 둔 동안에는 요청을 보내지 않다가 놓아주면 보내요', async () => {
    holdRequests();
    let isDone = false;
    const request = http('/v1/engine-status').then(() => {
      isDone = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(isDone).toBe(false);
    releaseRequests();
    await request;
    expect(isDone).toBe(true);
  });
});
