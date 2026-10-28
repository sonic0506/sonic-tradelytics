// M0 spike: 토스증권 오픈API 실제 호출 확인 (docs/integrations/toss-securities-api.md "남은 확인")
// 의존성 없음. Node 22+ (fetch, WebSocket 내장)
//
//   node --env-file=spikes/m0/.env spikes/m0/toss-spike.mjs rest
//   node --env-file=spikes/m0/.env spikes/m0/toss-spike.mjs ws 005930,000660 3600
//   node --env-file=spikes/m0/.env spikes/m0/toss-spike.mjs prices 005930,000660 3600
//   node --env-file=spikes/m0/.env spikes/m0/toss-spike.mjs orders 3600
//
// 주의: 클라이언트당 유효 토큰은 1개라 새로 발급하면 이전 토큰이 즉시 끊겨요.
// 그래서 발급한 토큰을 .token.json에 저장해 rest·ws가 같이 써요. 운영 중인 키로는 돌리지 마세요.

import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://openapi.tossinvest.com';
const WS_URL = 'wss://openapi-ws.tossinvest.com/ws/v1';
const TOKEN_FILE = new URL('./.token.json', import.meta.url);

const { TOSS_CLIENT_ID, TOSS_CLIENT_SECRET } = process.env;
if (!TOSS_CLIENT_ID || !TOSS_CLIENT_SECRET) {
  console.error('TOSS_CLIENT_ID, TOSS_CLIENT_SECRET 환경변수가 필요해요 (.env.example 참고)');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function getToken() {
  try {
    const t = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
    // 만료 60초 전부터는 재발급
    if (t.expiresAt - 60_000 > Date.now()) {
      log(`저장된 토큰 사용 (남은 시간 ${Math.round((t.expiresAt - Date.now()) / 1000)}초)`);
      return t.accessToken;
    }
  } catch {}

  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: TOSS_CLIENT_ID,
      client_secret: TOSS_CLIENT_SECRET,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`토큰 발급 실패 ${res.status}: ${JSON.stringify(body)}`);

  // 확인 항목: expires_in 실제 값
  log(`토큰 발급 성공 expires_in=${body.expires_in}초 (${(body.expires_in / 3600).toFixed(2)}시간) token_type=${body.token_type}`);
  writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }));
  return body.access_token;
}

async function api(token, path, accountSeq) {
  const headers = { Authorization: `Bearer ${token}` };
  if (accountSeq != null) headers['X-Tossinvest-Account'] = String(accountSeq);
  const res = await fetch(`${BASE}${path}`, { headers });
  const rl = ['limit', 'remaining', 'reset'].map((k) => res.headers.get(`x-ratelimit-${k}`)).join('/');
  const body = await res.json().catch(() => null);
  log(`GET ${path} → ${res.status} (rate limit/remaining/reset ${rl})`);
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body.result;
}

async function rest() {
  const token = await getToken();

  const accounts = await api(token, '/api/v1/accounts');
  // 계좌번호는 로그에 남기지 않아요
  console.log(accounts.map(({ accountSeq, accountType }) => ({ accountSeq, accountType })));
  if (!accounts.length) throw new Error('종합매매 계좌가 없어요');
  const seq = accounts[0].accountSeq;

  // 확인 항목: cashBuyingPower가 미체결 매수·D+2 미결제 매도를 어떻게 반영하는지
  // → 미체결 주문이 있을 때/없을 때, 당일 매도 직후에 각각 돌려서 앱 화면 금액과 비교
  console.dir(await api(token, '/api/v1/buying-power?currency=KRW', seq), { depth: null });
  console.dir(await api(token, '/api/v1/holdings', seq), { depth: null });

  log(`성공. 설정에 저장할 accountSeq=${seq}`);
}

// onMessage가 없으면 처음 3개만 원문을 찍어요(시세는 분당 수천 건이라)
async function ws(declare, seconds, onMessage) {
  const token = await getToken();
  // Node 내장 WebSocket(undici)은 비표준 headers 옵션을 받아요
  const sock = new WebSocket(WS_URL, { headers: { Authorization: `Bearer ${token}` } });
  const startedAt = Date.now();
  let total = 0, perMin = 0, shown = 0, ping;

  sock.onopen = () => {
    log('연결됨');
    // 선언은 배열 하나가 구독 전체예요. { id }는 ack·error에 그대로 돌아와요
    sock.send(JSON.stringify([...declare, { id: 'spike-1' }]));
    // 서버는 클라이언트 송신이 180초 없으면 끊어요. 60초 간격 PING
    ping = setInterval(() => sock.send('PING'), 60_000);
  };

  sock.onmessage = ({ data }) => {
    const f = JSON.parse(data);
    if (f.type === 'message') {
      total++, perMin++;
      if (onMessage) onMessage(f);
      else if (shown++ < 3) log('샘플', JSON.stringify(f));
    } else {
      log(f.type, JSON.stringify(f));
    }
  };

  const report = setInterval(() => {
    log(`경과 ${Math.round((Date.now() - startedAt) / 60_000)}분, 최근 1분 체결 ${perMin}건, 누적 ${total}건`);
    perMin = 0;
  }, 60_000);

  sock.onerror = (e) => log('에러', e.message ?? e);
  sock.onclose = ({ code, reason }) => {
    clearInterval(ping), clearInterval(report);
    const min = ((Date.now() - startedAt) / 60_000).toFixed(1);
    log(`종료 code=${code} reason=${reason || '-'} 유지 ${min}분 누적 ${total}건`);
    process.exitCode = Date.now() - startedAt >= seconds * 1000 - 5_000 ? 0 : 1;
  };

  setTimeout(() => sock.close(1000, 'spike done'), seconds * 1000);
}

// 확인 항목: personal:order 이벤트 형태, cashBuyingPower가 미체결 매수를 빼고 주는지
// → 실행해 둔 채 앱에서 소액 지정가 매수 → 취소(또는 체결)를 하면, 이벤트 원문과
//   이벤트 직후의 cashBuyingPower가 찍혀요. 시작 시 값과 비교해요
async function orders(seconds) {
  const token = await getToken();
  const [{ accountSeq }] = await api(token, '/api/v1/accounts');
  const buyingPower = async (when) => {
    const { cashBuyingPower } = await api(token, '/api/v1/buying-power?currency=KRW', accountSeq);
    log(`${when} cashBuyingPower=${cashBuyingPower}`);
  };
  await buyingPower('시작');
  // codes에는 종목이 아니라 accountSeq를 문자열로 넣어요 (asyncapi realtime-order)
  await ws([{ type: 'personal:order', codes: [String(accountSeq)] }], seconds, (f) => {
    const { event, order } = f.data;
    log(`주문 이벤트 ${event} status=${order.status}`, JSON.stringify(f));
    buyingPower(`${event} 직후`).catch((e) => log('에러', e.message));
  });
}

// 확인 항목: NXT 프리마켓(08:00~08:50) 체결이 통합 현재가에 반영되는지
// → 08:00 전에 시작해 30초마다 조회. 08:00 뒤 timestamp·lastPrice가 바뀌면 반영돼요
async function prices(codes, seconds) {
  const token = await getToken();
  const last = new Map();
  const poll = async () => {
    for (const { symbol, timestamp, lastPrice } of await api(token, `/api/v1/prices?symbols=${codes.join(',')}`)) {
      const changed = last.has(symbol) && last.get(symbol) !== `${timestamp}/${lastPrice}`;
      log(`${symbol} ${lastPrice}원 체결시각 ${timestamp}${changed ? ' ← 바뀜' : ''}`);
      last.set(symbol, `${timestamp}/${lastPrice}`);
    }
  };
  await poll();
  const timer = setInterval(() => poll().catch((e) => log('에러', e.message)), 30_000);
  setTimeout(() => clearInterval(timer), seconds * 1000);
}

const [cmd, codesArg = '005930', secondsArg = '3600'] = process.argv.slice(2);
if (cmd === 'rest') await rest();
else if (cmd === 'ws') await ws([{ type: 'trade:kr', codes: codesArg.split(',') }], Number(secondsArg));
else if (cmd === 'prices') await prices(codesArg.split(','), Number(secondsArg));
// orders는 종목 인자가 없어서 두 번째 인자가 초예요
else if (cmd === 'orders') await orders(Number(process.argv[3] ?? 3600));
else {
  console.error('사용법: toss-spike.mjs rest | ws [종목코드,...] [초] | prices [종목코드,...] [초] | orders [초]');
  process.exit(1);
}
