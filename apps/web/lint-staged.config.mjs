// 커밋 전에 staged 파일만 format + lint해요. 고칠 수 있는 건 고쳐서 커밋하고, 남은 lint 에러는 커밋을 막아요.
// typecheck·test·build는 CI(.github/workflows/ci.yml)가 맡아요.
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [
    'prettier --write',
    'eslint --fix --no-warn-ignored',
  ],
  '*.{json,md,css,yml,yaml}': 'prettier --write',
};
