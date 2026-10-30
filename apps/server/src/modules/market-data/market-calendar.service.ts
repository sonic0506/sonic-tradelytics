import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { kstDate } from '@/common/time/kst-date.js';
import { TossClient } from '@/infra/toss/toss.client.js';

import type { MarketCalendar } from './entities/market-calendar.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';

const session = z
  .object({ startTime: z.coerce.date(), endTime: z.coerce.date() })
  .nullable()
  .optional();
// 통합(KRX+NXT) 기준. 정규장이 null이면 정규장 휴장이에요
const daySchema = z.object({
  date: z.string(),
  integrated: z.object({ regularMarket: session }).nullable().optional(),
});
const calendarSchema = z.object({
  today: daySchema,
  previousBusinessDay: daySchema,
  nextBusinessDay: daySchema,
});

// 장 운영 캘린더 (POL-RISK-15). 개장 지연·단축 운영일도 토스 값을 따라가요.
@Injectable()
export class MarketCalendarService {
  // 시작 순서라 한도를 기다려도 돼요
  private static readonly WAIT_MS = 5000;

  private readonly logger = new Logger(MarketCalendarService.name);
  private today: MarketCalendar | undefined;
  private refreshing: Promise<MarketCalendar> | undefined;

  constructor(
    private readonly toss: TossClient,
    private readonly calendars: MarketCalendarRepository,
  ) {}

  // engine 시작 순서 3번: 오늘 캘린더가 DB에 없으면 토스에서 받아 저장해요. 실패하면 던져요(시작 실패)
  async ensureToday(): Promise<MarketCalendar> {
    const date = kstDate();
    const today =
      (await this.calendars.findByDate(date)) ?? (await this.fetch(date));
    this.today = today;
    return today;
  }

  // 오늘 정규장 시작·끝 시각. 휴장이거나 오늘 캘린더가 없으면 null
  regularSession(): { openAt: Date; closeAt: Date } | null {
    const today = this.today;
    if (
      today?.tradeDate !== kstDate() ||
      !today.isOpen ||
      today.regularOpenAt === null ||
      today.regularCloseAt === null
    )
      return null;
    return { openAt: today.regularOpenAt, closeAt: today.regularCloseAt };
  }

  // 지금이 정규장 시간인지. 오늘 캘린더가 없으면 매매하지 않는 쪽(false)으로 봐요
  isRegularSession(at: Date = new Date()): boolean {
    const today = this.today;
    if (today?.tradeDate !== kstDate(at)) {
      // ponytail: 날짜가 바뀌면 여기서 다시 받아요. 08:30 장전 배치를 만들면 거기서 받아요
      this.refresh();
      return false;
    }
    const { isOpen, regularOpenAt, regularCloseAt } = today;
    return (
      isOpen &&
      regularOpenAt !== null &&
      regularCloseAt !== null &&
      regularOpenAt <= at &&
      at < regularCloseAt
    );
  }

  private refresh(): void {
    if (this.refreshing) return;
    this.refreshing = this.ensureToday();
    this.refreshing
      .catch((error: unknown) => {
        this.logger.error(`장 캘린더를 받지 못했어요: ${String(error)}`);
      })
      .finally(() => {
        this.refreshing = undefined;
      });
  }

  // 전일·당일·익일을 함께 저장해요
  private async fetch(date: string): Promise<MarketCalendar> {
    const result = await this.toss.request({
      group: 'MARKET_INFO',
      path: '/api/v1/market-calendar/KR',
      query: { date },
      waitMs: MarketCalendarService.WAIT_MS,
      result: calendarSchema,
    });
    const fetchedAt = new Date();
    const toRow = ({
      date: tradeDate,
      integrated,
    }: z.infer<typeof daySchema>): MarketCalendar => {
      const regular = integrated?.regularMarket ?? null;
      return {
        tradeDate,
        isOpen: regular !== null,
        regularOpenAt: regular?.startTime ?? null,
        regularCloseAt: regular?.endTime ?? null,
        fetchedAt,
        createdAt: fetchedAt,
      };
    };
    const today = toRow(result.today);
    await this.calendars.upsert([
      toRow(result.previousBusinessDay),
      today,
      toRow(result.nextBusinessDay),
    ]);
    return today;
  }
}
