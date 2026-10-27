import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

import { PUBLIC_EXTENSION, ROLES_EXTENSION } from '../exceptions/api-errors.js';
import type { AuthRequest, AuthUser, Role } from './roles.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

// 모든 API는 기본으로 로그인이 필요해요(전역 JwtAuthGuard). 열어 둘 API에만 붙여요.
// Swagger 표시도 같이 해요: 공개 API는 401 응답과 자물쇠가 없고, @Roles API에는 403 응답이 붙어요(api-errors.ts).
export const Public = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    ApiExtension(PUBLIC_EXTENSION, true),
  );

export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiExtension(ROLES_EXTENSION, roles),
  );

// 로그인한 사용자: handler(@CurrentUser() user: AuthUser). user.sub로 본인 데이터만 다뤄요.
// guard를 지난 요청이라 늘 있지만, @Public() API에서 쓰면 빈 값 대신 401로 끝내요.
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => {
    const { user } = context.switchToHttp().getRequest<AuthRequest>();
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
