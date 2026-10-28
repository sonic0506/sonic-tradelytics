import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

// DART 공시 목록. 장전 점검의 공시 경계 근거예요 (POL-REEV-06).
// 컬럼 이름은 DART 응답 필드를 그대로 따라요.
@Entity('disclosures')
@Index(['stockCode', 'rceptDt'])
export class Disclosure {
  // 접수 번호
  @PrimaryColumn('text')
  rceptNo: string;

  @Column('text')
  stockCode: string;

  // 공시 유형 (B, I 등)
  @Column('char', { length: 1 })
  pblntfTy: string;

  @Column('text')
  reportNm: string;

  @Column('date')
  rceptDt: string;

  @Column('timestamptz')
  fetchedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
