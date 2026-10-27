import {
  type INestApplication,
  RequestMethod,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants.js';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { IS_PUBLIC_KEY } from '@/common/auth/auth.decorators.js';

import { createTestApp } from './setup/test-app.js';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface Route {
  method: HttpMethod;
  path: string;
}

// @Public()이 없는 모든 라우트를 모아요. 새 API를 만들면 자동으로 이 테스트에 들어가요.
function protectedRoutes(app: INestApplication): Route[] {
  const reflector = app.get(Reflector);
  const first = <T>(value: T | T[] | undefined): T | undefined =>
    Array.isArray(value) ? value[0] : value;
  const routes: Route[] = [];
  for (const { instance, metatype } of app
    .get(DiscoveryService)
    .getControllers()) {
    if (!instance || !metatype) continue;
    const prototype = Object.getPrototypeOf(instance) as Record<
      string,
      unknown
    >;
    const version = first(reflector.get(VERSION_METADATA, metatype)) as
      string | symbol | undefined;
    const prefix =
      version === VERSION_NEUTRAL ? '' : `v${String(version ?? '1')}`;
    const base = first(reflector.get(PATH_METADATA, metatype)) as string;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const path = first(reflector.get(PATH_METADATA, handler)) as
        string | undefined;
      if (path === undefined) continue;
      const isPublic = reflector.getAllAndOverride<boolean | undefined>(
        IS_PUBLIC_KEY,
        [handler, metatype],
      );
      if (isPublic) continue;
      const method = RequestMethod[
        reflector.get(METHOD_METADATA, handler) as RequestMethod
      ].toLowerCase() as HttpMethod;
      const url = `/${[prefix, base, path].filter(Boolean).join('/')}`
        .replace(/\/+/g, '/')
        .replace(/:\w+/g, '1');
      routes.push({ method, path: url });
    }
  }
  return routes;
}

describe('전역 인증 guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([DiscoveryModule]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('공개 API가 아니면 토큰 없이 부를 때 401을 돌려줘요', async () => {
    for (const route of protectedRoutes(app)) {
      const response = await request(app.getHttpServer())[route.method](
        route.path,
      );
      expect(response.status, `${route.method} ${route.path}`).toBe(401);
    }
  });

  it('만료(exp)가 없는 토큰이면 401을 돌려줘요', async () => {
    // 앱의 JwtService는 늘 exp를 붙여서, 만료 옵션 없이 같은 비밀 값으로 따로 서명해요.
    const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({
      sub: '1',
      roles: ['admin'],
    });
    for (const route of protectedRoutes(app)) {
      const call = request(app.getHttpServer())[route.method](route.path);
      const response = await call.set('Authorization', `Bearer ${token}`);
      expect(response.status, `${route.method} ${route.path}`).toBe(401);
    }
  });

  it('토큰이 올바르지 않으면 401을 돌려줘요', async () => {
    for (const route of protectedRoutes(app)) {
      const call = request(app.getHttpServer())[route.method](route.path);
      const response = await call.set('Authorization', 'Bearer invalid');
      expect(response.status, `${route.method} ${route.path}`).toBe(401);
    }
  });
});
