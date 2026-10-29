import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  type DecisionFields,
  DecisionRepository,
} from './decision.repository.js';

// 판단 기록 (ADR-0003). 주문 전에 저장하고, id가 그대로 clientOrderId가 돼요 (POL-RISK-07)
@Injectable()
export class DecisionService {
  constructor(private readonly decisions: DecisionRepository) {}

  // 그 포지션 첫 진입 판단의 봇 버전 (청산 판단도 진입 때 버전으로 남겨요)
  async entryVersionId(positionId: number): Promise<number | null> {
    return (await this.decisions.findEntry(positionId))?.botVersionId ?? null;
  }

  // 그 포지션 첫 진입 판단의 손절가 (손절 조건주문 발동가, POL-RISK-11)
  async entryStopPrice(positionId: number): Promise<number | null> {
    return (await this.decisions.findEntry(positionId))?.stopPrice ?? null;
  }

  // 저장한 판단 id를 돌려줘요. 호출하는 쪽 트랜잭션 안에서 함께 저장돼요
  async record(
    fields: Omit<DecisionFields, 'id' | 'decidedAt'>,
  ): Promise<string> {
    const id = randomUUID();
    await this.decisions.add({ ...fields, id, decidedAt: new Date() });
    return id;
  }
}
