// 리플레이(지난 장으로 BotRunner·PaperBroker를 미리 돌려 보기)용 시세를 받아 JSON으로 저장해요.
//   node --env-file=.env scripts/replay-fetch.mjs 2026-10-30 /tmp/replay-2026-10-30.json
// engine이 저장한 토큰 파일을 읽기만 해요. 새로 발급하지 않아요(발급하면 engine 토큰이 끊겨요, R-014).
// 후보는 그 날 거래대금 상위 50종목(rankings duration=1d)이라 장 마감 뒤 같은 날에 받아야 해요.
import { readFileSync, writeFileSync } from 'node:fs';

const [date, out] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !out) {
  console.error('사용법: replay-fetch.mjs YYYY-MM-DD 출력.json');
  process.exit(1);
}
const base = process.env.TOSS_API_BASE_URL ?? 'https://openapi.tossinvest.com';
const { accessToken, expiresAt } = JSON.parse(
  readFileSync(process.env.TOSS_TOKEN_FILE ?? '.toss-token.json', 'utf8'),
);
if (expiresAt <= Date.now()) {
  console.error(
    'engine 토큰이 만료됐어요. engine을 켜서 토큰을 갱신한 뒤 다시 받아요',
  );
  process.exit(1);
}

const get = async (path, query) => {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok)
    throw new Error(`${response.status} ${path}: ${await response.text()}`);
  return (await response.json()).result;
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));

const { rankings } = await get('/api/v1/rankings', {
  type: 'MARKET_TRADING_AMOUNT',
  marketCountry: 'KR',
  duration: '1d',
  excludeInvestmentCaution: true,
  count: 50,
});
const open = new Date(`${date}T09:00:00+09:00`);
const close = new Date(`${date}T15:30:00+09:00`);

// 정규장 끝부터 거꾸로 받아 정규장 봉만 남겨요
async function candlesOf(symbol, before = close.toISOString(), acc = []) {
  const page = await get('/api/v1/candles', {
    symbol,
    interval: '1m',
    count: 200,
    before,
  });
  await pause();
  const bars = page.candles
    .map((c) => ({
      t: new Date(c.timestamp).getTime(),
      o: Number(c.openPrice),
      h: Number(c.highPrice),
      l: Number(c.lowPrice),
      c: Number(c.closePrice),
      v: Number(c.volume),
    }))
    .filter(({ t }) => t > open.getTime() && t <= close.getTime());
  const all = [...acc, ...bars];
  const oldest = page.candles.at(-1);
  if (!oldest || !page.nextBefore || new Date(oldest.timestamp) <= open)
    return all.sort((a, b) => a.t - b.t);
  return candlesOf(symbol, page.nextBefore, all);
}

// 종목마다 차례로 받아요 (MARKET_DATA_CHART 초당 20회 안)
const candles = {};
await rankings.reduce(
  (previous, { symbol }) =>
    previous.then(async () => {
      candles[symbol] = await candlesOf(symbol);
    }),
  Promise.resolve(),
);
writeFileSync(
  out,
  JSON.stringify({
    date,
    ranked: rankings.map(({ symbol, rank }) => ({ symbol, rank })),
    candles,
  }),
);
const bars = Object.values(candles).reduce((sum, list) => sum + list.length, 0);
console.log(`${date}: ${rankings.length}종목, 1분봉 ${bars}개 → ${out}`);
