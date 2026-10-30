// MSW handler 주소. 서버(절대 주소)와 브라우저(/api) 요청을 함께 받도록 앞을 *로 둬요.
export function mockApiUrl(path: string) {
  return `*/api${path}`;
}
