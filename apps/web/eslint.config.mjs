// 프로젝트 ESLint 설정 (Next.js).
// 하네스 공통 규칙은 .sonic-harness/eslint.base.mjs에 있어요(/sonic-harness:update로 갱신).
// 공통 규칙을 바꾸고 싶으면 그 파일을 고친 뒤 /sonic-harness:contribute로 원본에 PR을 올려요.
import nextPlugin from '@next/eslint-plugin-next';

import harness from './.sonic-harness/eslint.base.mjs';
// 디자인 규칙(sonic-ui): DESIGN.md의 토큰 밖 값(임의 값 클래스, 기본 팔레트, hex)을 막아요.
import sonicDesign from '@xonic0506/sonic-ui/eslint-design-rules';

export default [
  ...harness,
  nextPlugin.configs['core-web-vitals'],
  sonicDesign,
  // 이 프로젝트에만 필요한 규칙은 여기에 둬요.
  // 타입 정보는 이 폴더의 tsconfig로 읽어요. 에디터처럼 저장소 루트에서 실행해도 CLI와 같은 결과가 나와요
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];
