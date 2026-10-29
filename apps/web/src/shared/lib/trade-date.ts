const tradeDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// 서울 기준 날짜 "YYYY-MM-DD" (api의 from·to 형식)
export function toTradeDate(date: Date) {
  return tradeDateFormat.format(date);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}
