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

  findLatest(kind: RiskEventKind): Promise<RiskEvent | null> {
    return this.events.findOne({
      where: { kind },
      order: { occurredAt: 'DESC' },
    });
  }
}
