import { describe, expect, it } from 'vitest';

import { HttpError } from './http';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('4xx는 다시 시도하지 않아요', () => {
    expect(shouldRetry(0, new HttpError(404, '/v1/bots/x'))).toBe(false);
  });

  it('5xx와 네트워크 오류는 세 번까지 다시 시도해요', () => {
    expect(shouldRetry(2, new HttpError(500, '/v1/bots'))).toBe(true);
    expect(shouldRetry(3, new Error('network'))).toBe(false);
  });
});
