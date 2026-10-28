// 배치 job (docs/architecture/engine.md 배치 스케줄)
export const BATCH_JOBS = [
  'pre_open',
  'open_snapshot',
  'open_check',
  'intraday_check',
  'post_close',
  'weekly_check',
] as const;
export type BatchJob = (typeof BATCH_JOBS)[number];

// skipped는 휴장일
export const BATCH_RESULTS = ['ok', 'failed', 'skipped'] as const;
export type BatchResult = (typeof BATCH_RESULTS)[number];
