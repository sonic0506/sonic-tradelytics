// 시각은 서버와 브라우저가 같은 글자를 그리도록 Asia/Seoul로 고정해요.
const TIME_ZONE = 'Asia/Seoul';

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const hourMinuteFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "14:32:05"
export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

// "14:21"
export function formatHourMinute(iso: string) {
  return hourMinuteFormat.format(new Date(iso));
}

// 거래일 "2026-10-08" → "10/8"
export function formatMonthDay(tradeDate: string) {
  const [, month, day] = tradeDate.split('-');
  return `${Number(month)}/${Number(day)}`;
}
