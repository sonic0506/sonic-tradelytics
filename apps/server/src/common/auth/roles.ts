import type { Request } from 'express';
import { z } from 'zod';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

// JWT payload에서 꺼내 request.user에 두는 값이에요. exp가 없는 토큰(만료되지 않는 토큰)은 받지 않아요.
export const authUserSchema = z.object({
  sub: z.string(),
  roles: z.array(z.enum(ROLES)),
  exp: z.number(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export type AuthRequest = Request & { user?: AuthUser };
