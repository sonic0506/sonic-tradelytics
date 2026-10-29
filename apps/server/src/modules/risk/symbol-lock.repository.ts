import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, type Repository } from 'typeorm';

import { isUniqueViolation } from '@/infra/database/unique-violation.js';

import { SymbolLock } from './entities/symbol-lock.entity.js';

@Injectable()
export class SymbolLockRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get locks(): Repository<SymbolLock> {
    return this.txHost.tx.getRepository(SymbolLock);
  }

  findActive(symbol: string): Promise<SymbolLock | null> {
    return this.locks.findOneBy({ symbol, releasedAt: IsNull() });
  }

  // 잠금 획득은 INSERT 성공 여부로 판단해요. 다른 봇이 잡고 있으면 DB unique가 막아서 false예요
  async add(symbol: string, botId: number, acquiredAt: Date): Promise<boolean> {
    try {
      await this.locks.insert({ symbol, botId, acquiredAt });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async release(
    symbol: string,
    botId: number,
    releasedAt: Date,
  ): Promise<void> {
    await this.locks.update(
      { symbol, botId, releasedAt: IsNull() },
      { releasedAt },
    );
  }
}
