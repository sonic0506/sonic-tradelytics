import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, type Repository } from 'typeorm';

import { RiskEvent } from './entities/risk-event.entity.js';
import type { RiskEventKind } from './risk.constants.js';

@Injectable()
export class RiskRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get events(): Repository<RiskEvent> {
    return this.txHost.tx.getRepository(RiskEvent);
  }

  async add(
    fields: Pick<RiskEvent, 'kind' | 'botId' | 'occurredAt' | 'detail'>,
  ): Promise<void> {
    await this.events.save(this.events.create(fields));
  }

  // 아직 알리지 않은 이벤트를 일어난 순서대로
  findUnnotified(take: number): Promise<RiskEvent[]> {
    return this.events.find({
      where: { notifiedAt: IsNull() },
      order: { occurredAt: 'ASC', id: 'ASC' },
      take,
    });
  }

  // DB 트리거가 notified_at을 null에서 한 번 채우는 것만 허용해요
  async markNotified(id: number, notifiedAt: Date): Promise<void> {
    await this.events.update({ id, notifiedAt: IsNull() }, { notifiedAt });
  }

  // 화면 목록: 최신순. 봇·종류·기간(occurredAt 범위)으로 걸러요
  findPage(filter: {
    botIds?: number[];
    kinds?: RiskEventKind[];
    from?: Date;
    until?: Date;
    skip: number;
    take: number;
  }): Promise<[RiskEvent[], number]> {
    const query = this.events
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.bot', 'bot')
      .orderBy('event.occurredAt', 'DESC')
      .addOrderBy('event.id', 'DESC');
    if (filter.botIds?.length)
      query.andWhere('event.botId IN (:...botIds)', { botIds: filter.botIds });
    if (filter.kinds?.length)
      query.andWhere('event.kind IN (:...kinds)', { kinds: filter.kinds });
    if (filter.from)
      query.andWhere('event.occurredAt >= :from', { from: filter.from });
    if (filter.until)
      query.andWhere('event.occurredAt < :until', { until: filter.until });
    return query.skip(filter.skip).take(filter.take).getManyAndCount();
  }

  findLatest(kind: RiskEventKind): Promise<RiskEvent | null> {
    return this.events.findOne({
      where: { kind },
      order: { occurredAt: 'DESC' },
    });
  }
}
