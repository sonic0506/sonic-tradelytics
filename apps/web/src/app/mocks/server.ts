import { setupServer } from 'msw/node';

import { handlers } from './handlers';

// 개발 화면에서 서버 컴포넌트의 prefetch를 받아요(루트 instrumentation.ts가 시작해요).
// 테스트는 @/shared/testing의 server를 써요.
export const server = setupServer(...handlers);
