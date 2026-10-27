import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { handlers } from './src/app/mocks/handlers';
import { server } from './src/shared/testing/server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => server.use(...handlers));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
