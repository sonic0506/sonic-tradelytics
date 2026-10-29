// 거래일은 한국 시간 기준이에요. 서버 시간대는 UTC라서 날짜를 따로 계산해요
const kstFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

// YYYY-MM-DD (KST)
export function kstDate(at: Date = new Date()): string {
  return kstFormat.format(at);
}
