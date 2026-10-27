// Conventional Commits. 설명은 한국어로 써요: feat(api-key): 목록 화면 추가
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 한국어 설명에는 대소문자 규칙이 맞지 않아 끄고, 대신 한글이 들어 있는지 확인해요.
    'subject-case': [0],
    'subject-korean': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'subject-korean': ({ subject }) => [
          /[가-힣]/.test(subject ?? ''),
          '커밋 설명은 한국어로 써요. 예: feat(api-key): 목록 화면 추가',
        ],
      },
    },
  ],
};
