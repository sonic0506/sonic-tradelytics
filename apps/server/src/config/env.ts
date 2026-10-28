import { z } from 'zod';

// 환경 변수는 여기서만 읽어요(lint: sonic-be/no-direct-env). 키를 바꾸면 .env.example도 같이 바꿔요.
// 비어 있는 값(KEY=)은 없는 것으로 봐요. .env.example을 그대로 복사해도 검증을 통과해요
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

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
    // 토스 Open API: engine만 써요. api 프로세스에는 넣지 않아서 선택 값이에요(TossClient가 시작할 때 확인해요).
    // 개발과 운영은 다른 키를 써요. 같은 키로 발급하면 운영 토큰이 끊겨요(R-014).
    TOSS_CLIENT_ID: optionalString,
    TOSS_CLIENT_SECRET: optionalString,
    // GET /api/v1/accounts의 accountSeq
    TOSS_ACCOUNT_SEQ: optionalString,
    TOSS_API_BASE_URL: z.url().default('https://openapi.tossinvest.com'),
    // 발급한 토큰을 저장하는 파일. 재시작해도 다시 발급하지 않게 engine 볼륨에 둬요
    TOSS_TOKEN_FILE: z.string().min(1).default('.toss-token.json'),
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
