import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';

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

  findLatest(kind: RiskEventKind): Promise<RiskEvent | null> {
    return this.events.findOne({
      where: { kind },
      order: { occurredAt: 'DESC' },
    });
  }
}
