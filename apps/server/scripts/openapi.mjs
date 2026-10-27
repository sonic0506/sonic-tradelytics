// OpenAPI 문서를 openapi.json으로 만들어요. --check면 커밋된 파일과 다를 때 실패해요(CI).
// DB 없이 돌도록 preview 모드로 모듈 구조만 읽어요. 빌드 결과(dist)를 읽어서 먼저 nest build가 필요해요.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// env.ts가 검증하는 값이에요. 문서만 만들 때는 DB에 연결하지 않아서 가짜 값이면 돼요.
process.env.DATABASE_URL ??=
  'postgres://openapi:openapi@localhost:5432/openapi';
process.env.JWT_SECRET ??= 'openapi-only-secret-openapi-only-secret';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { createOpenApiDocument, VERSIONING } =
  await import('../dist/app.setup.js');

const FILE = 'openapi.json';
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
app.enableVersioning(VERSIONING);
const json = `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`;
await app.close();

if (process.argv.includes('--check')) {
  if (!existsSync(FILE) || readFileSync(FILE, 'utf8') !== json) {
    console.error(
      '✗ openapi.json이 코드와 달라요. npm run openapi로 다시 만들고 커밋해요.',
    );
    process.exit(1);
  }
  console.log('✓ openapi.json이 코드와 같아요.');
} else {
  writeFileSync(FILE, json);
  console.log('✓ openapi.json을 만들었어요.');
}
