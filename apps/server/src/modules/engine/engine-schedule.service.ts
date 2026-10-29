import { Injectable, Logger } from '@nestjs/common';

import { kstAt, kstDate } from '@/common/time/kst-date.js';
import { TossClient } from '@/infra/toss/toss.client.js';
import { AccountSyncService } from '@/modules/account/index.js';
import { MarketCalendarService } from '@/modules/market-data/index.js';
import { RiskService } from '@/modules/risk/index.js';

import { type BatchKey, BatchRunRepository } from './batch-run.repository.js';
import type { BatchJob } from './engine.constants.js';

interface ScheduledJob {
  job: BatchJob;
  // HH:mm (KST)
  time: string;
  run: () => Promise<unknown>;
}

// 일일 배치를 KST 시각에 돌려요 (docs/architecture/engine.md 배치 스케줄).
// ponytail: 정해진 시각 두 개라 @nestjs/schedule 없이 setTimeout으로 돌려요. job이 늘어 cron 표현이 필요해지면 설치해요.
// ponytail: 개장 지연일에도 시각을 미루지 않아요. 장전 점검이 생기면 regular_open_at 기준으로 미뤄요
@Injectable()
export class EngineScheduleService {
  private static readonly DAY_MS = 86_400_000;

  private readonly logger = new Logger(EngineScheduleService.name);
  private readonly timers = new Map<BatchJob, NodeJS.Timeout>();
  private readonly jobs: ScheduledJob[];

  constructor(
    private readonly runs: BatchRunRepository,
    private readonly calendar: MarketCalendarService,
    private readonly risk: RiskService,
    toss: TossClient,
    accountSync: AccountSyncService,
  ) {
    // 지금 할 일이 있는 job만 등록해요. 나머지(재평가·스냅샷·집계)는 그 기능을 만들 때 더해요
    this.jobs = [
      // 토큰·오늘 캘린더 확인
      {
        job: 'pre_open',
        time: '08:30',
        run: async () => {
          await toss.ensureToken();
          await this.calendar.ensureToday();
        },
      },
      // 오늘 CLOSED 전량으로 체결 최종 확정
      { job: 'post_close', time: '15:40', run: () => accountSync.syncAll() },
    ];
  }

  // engine 시작 순서 9번: 오늘 시각이 지났는데 끝나지 않은 배치를 먼저 돌리고, 다음 시각을 예약해요
  async start(now: Date = new Date()): Promise<void> {
    const today = kstDate(now);
    const missed = this.jobs.filter(({ time }) => kstAt(today, time) <= now);
    await missed.reduce<Promise<void>>(
      (previous, job) => previous.then(() => this.run(job)),
      Promise.resolve(),
    );
    for (const job of this.jobs) this.schedule(job, now);
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private schedule(job: ScheduledJob, now: Date): void {
    let at = kstAt(kstDate(now), job.time);
    if (at <= now) at = new Date(at.getTime() + EngineScheduleService.DAY_MS);
    this.timers.set(
      job.job,
      setTimeout(() => {
        void this.run(job).finally(() => {
          this.schedule(job, new Date());
        });
      }, at.getTime() - now.getTime()),
    );
  }

  // 같은 거래일에 이미 끝난 배치는 다시 돌리지 않아요. 실패했으면 다시 돌려요
  private async run(job: ScheduledJob): Promise<void> {
    const key: BatchKey = { job: job.job, tradeDate: kstDate(), slot: '' };
    try {
      const done = await this.runs.find(key);
      if (done?.result === 'ok' || done?.result === 'skipped') return;
      await this.runs.start(key, new Date());
      const today = await this.calendar.ensureToday();
      if (!today.isOpen) {
        await this.runs.finish(key, 'skipped', null);
        return;
      }
      await job.run();
      await this.runs.finish(key, 'ok', null);
    } catch (error) {
      this.logger.error(`배치 ${job.job} 실패: ${String(error)}`);
      await this.fail(key, String(error));
    }
  }

  // 실패 기록도 실패하면 로그만 남겨요(다음 시작 때 놓친 배치로 다시 돌아요)
  private async fail(key: BatchKey, error: string): Promise<void> {
    try {
      await this.runs.finish(key, 'failed', error);
      await this.risk.record('batch_fail', null, { ...key, error });
    } catch (recordError) {
      this.logger.error(
        `배치 ${key.job} 실패를 기록하지 못했어요: ${String(recordError)}`,
      );
    }
  }
}
