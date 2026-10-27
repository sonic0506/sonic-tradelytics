import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './setup/test-app.js';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('DB에 연결되면 200과 X-Request-Id를 돌려줘요', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('없는 경로는 표준 에러 형식으로 404를 돌려줘요', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/not-found')
      .expect(404);

    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.body).toMatchObject({ status: 404, code: 'HTTP_404' });
  });
});
