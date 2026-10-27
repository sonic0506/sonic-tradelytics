import { setupServer } from 'msw/node';

// handler는 vitest.setup.ts가 app/mocks에서 가져와 등록해요. 테스트에서는 server.use로 덮어써요.
export const server = setupServer();
