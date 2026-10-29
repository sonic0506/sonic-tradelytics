import { Test } from '@nestjs/testing';

import { EngineStateService } from './engine-state.service.js';

describe('EngineStateService', () => {
  let state: EngineStateService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [EngineStateService],
    }).compile();
    state = moduleRef.get(EngineStateService);
  });

  it('처음에는 모든 봇이 진입할 수 있고 running이에요', () => {
    expect(state.canEnter(1)).toBe(true);
    expect(state.canOrder()).toBe(true);
    expect(state.state()).toBe('running');
  });

  it('전체 정지는 모든 봇의 신규 진입을 막지만 주문(청산·취소)은 막지 않아요', () => {
    state.halt('kill');

    expect(state.canEnter(1)).toBe(false);
    expect(state.canOrder()).toBe(true);
    expect(state.state()).toBe('halted');
    expect(state.haltReasons()).toEqual(['kill']);
  });

  it('종료 중에는 모든 주문을 막아요', () => {
    state.halt('stopping');

    expect(state.canOrder()).toBe(false);
    expect(state.state()).toBe('stopping');
  });

  it('정지 사유가 모두 풀려야 다시 진입할 수 있어요', () => {
    state.halt('kill');
    state.halt('token');

    state.release('kill');
    expect(state.canEnter(1)).toBe(false);

    state.release('token');
    expect(state.canEnter(1)).toBe(true);
  });

  it('봇 정지는 그 봇만 막아요', () => {
    state.blockBot(1, 'pause');

    expect(state.canEnter(1)).toBe(false);
    expect(state.canEnter(2)).toBe(true);
    expect(state.botBlockReason(1)).toBe('pause');

    state.unblockBot(1);
    expect(state.canEnter(1)).toBe(true);
  });
});
