// 커밋 전에 바뀐 파일만 Claude hook과 같은 규칙(format + lint)으로 검사해요.
export default {
  '*.{ts,mjs,js}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
