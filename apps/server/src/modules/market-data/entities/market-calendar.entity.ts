import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// 토스 market-calendar/KR 사본.
@Entity('market_calendars')
export class MarketCalendar {
  @PrimaryColumn('date')
  tradeDate: string;

  // integrated가 null이면 false
  @Column('boolean')
  isOpen: boolean;

  // 개장 지연일 대응
  @Column('timestamptz', { nullable: true })
  regularOpenAt: Date | null;

  @Column('timestamptz', { nullable: true })
  regularCloseAt: Date | null;

  @Column('timestamptz')
  fetchedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
