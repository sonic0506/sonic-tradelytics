// CI의 하네스 검사예요: node scripts/harness-checks.mjs <env|e2e|deps ...>
//   env   .env.example의 키와 src/config/env.ts 스키마의 키가 같아요
//   e2e   controller마다 test/<이름>.e2e-spec.ts가 있어요
//   deps  PR에서 패키지가 늘었으면 PR 본문 "## 새 의존성"에 이유가 있어요(환경 변수 PR_BODY, BASE_REF)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const keys = (text, pattern) =>
  new Set([...text.matchAll(pattern)].map((m) => m[1]));

const checks = {
  env() {
    // 스키마 키는 z.object({ ... }) 안의 4칸 들여쓴 대문자 키예요(Prettier 형식).
    const schema = keys(
      readFileSync('src/config/env.ts', 'utf8'),
      /^ {4}([A-Z][A-Z0-9_]*):/gm,
    );
    const example = keys(
      readFileSync('.env.example', 'utf8'),
      /^([A-Z][A-Z0-9_]*)=/gm,
    );
    for (const key of schema)
      if (!example.has(key)) failures.push(`.env.example에 ${key}가 없어요.`);
    for (const key of example)
      if (!schema.has(key))
        failures.push(`.env.example의 ${key}가 env.ts 스키마에 없어요.`);
  },
  e2e() {
    for (const layer of ['src/modules', 'src/compositions']) {
      if (!existsSync(layer)) continue;
      for (const feature of readdirSync(layer))
        for (const file of readdirSync(join(layer, feature)))
          if (file.endsWith('.controller.ts')) {
            const spec = `test/${file.replace('.controller.ts', '')}.e2e-spec.ts`;
            if (!existsSync(spec))
              failures.push(
                `${layer}/${feature}/${file}의 e2e(${spec})가 없어요.`,
              );
          }
    }
  },
  deps() {
    const base = process.env.BASE_REF;
    if (!base) return console.log('PR이 아니라 deps 검사는 건너뛰어요.');
    const names = (pkg) =>
      Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const before = new Set(
      names(
        JSON.parse(
          execFileSync('git', ['show', `origin/${base}:./package.json`], {
            encoding: 'utf8',
          }),
        ),
      ),
    );
    const added = names(
      JSON.parse(readFileSync('package.json', 'utf8')),
    ).filter((name) => !before.has(name));
    if (!added.length) return;
    const section = (process.env.PR_BODY ?? '')
      .split(/^## /m)
      .find((s) => s.startsWith('새 의존성'));
    const reason = (section ?? '')
      .replace('새 의존성', '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    if (!reason || reason === '없음')
      failures.push(
        `새 패키지(${added.join(', ')})가 있어요. PR 본문 "## 새 의존성"에 이유를 적어요.`,
      );
  },
};

const names = process.argv.slice(2);
for (const name of names)
  (checks[name] ?? (() => failures.push(`모르는 검사: ${name}`)))();
if (failures.length) {
  console.error(failures.map((f) => `✗ ${f}`).join('\n'));
  process.exit(1);
}
console.log(`✓ 하네스 검사 통과: ${names.join(', ')}`);
