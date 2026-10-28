import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// 보유 종목의 최근 가격 (FR-PERF-06). engine이 메모리 스냅샷에서 5초마다 덮어써요.
@Entity('quote_caches')
export class QuoteCache {
  @PrimaryColumn('text')
  symbol: string;

  // 최근 체결가
  @Column('bigint')
  price: number;

  // 시세 수신 시각 (화면의 기준 시각)
  @Column('timestamptz')
  receivedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
