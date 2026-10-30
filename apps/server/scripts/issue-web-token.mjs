// web 서버가 api를 부를 때 쓰는 토큰을 만들어 출력만 해요 (docs/architecture/api.md 인증, Q-021).
//   node --env-file=.env scripts/issue-web-token.mjs
// 출력한 값을 web 서버 환경 변수(API_TOKEN)에만 넣어요. 파일에 남기지 않아요.
// 토큰이 새었으면 JWT_SECRET을 바꿔 기존 토큰을 모두 무효로 만들어요.
import { createHmac } from 'node:crypto';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('JWT_SECRET(32자 이상)이 필요해요');
  process.exit(1);
}
const YEAR_SECONDS = 365 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'web',
  roles: ['admin'],
  iat: now,
  exp: now + YEAR_SECONDS,
})}`;
const signature = createHmac('sha256', secret)
  .update(unsigned)
  .digest('base64url');
console.log(`${unsigned}.${signature}`);
