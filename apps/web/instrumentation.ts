// Next 서버가 시작할 때 한 번 실행돼요.
// NEXT_RUNTIME을 글자 그대로 써야 Edge 번들에서 Node 전용 코드(msw/node)가 빠져요.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
