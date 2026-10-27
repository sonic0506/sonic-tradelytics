import { z } from 'zod';

// 환경 변수는 여기서만 읽어요(lint: sonic-be/no-direct-env). 키를 바꾸면 .env.example도 같이 바꿔요.
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    TZ: z.literal('UTC').default('UTC'),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    // 발급 토큰의 유효 시간(초)
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  })
  .refine(
    (value) =>
      value.NODE_ENV !== 'production' || !value.CORS_ORIGINS.includes('*'),
    {
      message: '운영 환경에서는 CORS_ORIGINS에 *를 쓸 수 없어요.',
      path: ['CORS_ORIGINS'],
    },
  );

export const env = envSchema.parse(process.env);

// 시각은 UTC로만 다뤄요. 서버 시간대가 달라도 Date 계산이 같게 나와요.
process.env.TZ = env.TZ;
