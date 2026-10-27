import type { RequestHandler } from 'msw';

// 각 slice의 api/*.mock.ts에서 만든 handler(index.ts로 export)를 app 레이어에서 모아요.
// shared는 entities를 모르기 때문에 여기서 모아요.
export const handlers: RequestHandler[] = [];
