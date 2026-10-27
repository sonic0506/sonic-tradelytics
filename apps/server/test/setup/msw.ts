import { setupServer } from 'msw/node';

// 외부 HTTP API는 MSW로 바꿔요: server.use(http.get('https://api.example.com/...', () => HttpResponse.json(...)))
// 로컬(supertest가 띄운 앱) 요청은 그대로 보내고, 처리하지 않은 외부 요청은 실패로 봐요.
export const server = setupServer();

beforeAll(() => {
  server.listen({
    onUnhandledRequest: (request, print) => {
      const { hostname } = new URL(request.url);
      if (hostname !== '127.0.0.1' && hostname !== 'localhost') print.error();
    },
  });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
