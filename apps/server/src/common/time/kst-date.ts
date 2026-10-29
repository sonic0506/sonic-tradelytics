// 거래일은 한국 시간 기준이에요. 서버 시간대는 UTC라서 날짜를 따로 계산해요
const kstFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

// YYYY-MM-DD (KST)
export function kstDate(at: Date = new Date()): string {
  return kstFormat.format(at);
}

const kstTimeFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'short',
  timeStyle: 'short',
});

// YYYY-MM-DD HH:mm (KST). 알림처럼 사람이 읽는 곳에 써요
export function kstDateTime(at: Date): string {
  return kstTimeFormat.format(at);
}

// 그 날(KST)의 HH:mm 시각. 한국은 서머타임이 없어서 +09:00으로 고정해요
export function kstAt(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

const kstClockFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  timeStyle: 'medium',
});

// HH:mm:ss (KST). Postgres time 컬럼 값('09:00:00')과 문자열로 비교할 수 있어요
export function kstTime(at: Date = new Date()): string {
  return kstClockFormat.format(at);
}
