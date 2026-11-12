import { HttpStatus } from '@nestjs/common';

import {
  AppException,
  type FieldError,
} from '@/common/exceptions/app.exception.js';

export class BotNotFoundException extends AppException {
  static readonly code = 'BOT_NOT_FOUND';
  static readonly status = HttpStatus.NOT_FOUND;
  static readonly example = '봇 1을(를) 찾을 수 없어요.';

  constructor(id: number) {
    super(
      BotNotFoundException.code,
      BotNotFoundException.status,
      `봇 ${id}을(를) 찾을 수 없어요.`,
    );
  }
}

// POL-FUND-03: 같은 시각에 시작하는 정률 봇들의 합이 100%를 넘어요
export class BudgetRatioExceededException extends AppException {
  static readonly code = 'BUDGET_RATIO_EXCEEDED';
  static readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  static readonly example = '09:05에 시작하는 정률 봇들의 합이 100%를 넘어요.';

  constructor(tradingStart: string) {
    super(
      BudgetRatioExceededException.code,
      BudgetRatioExceededException.status,
      `${tradingStart}에 시작하는 정률 봇들의 합이 100%를 넘어요.`,
    );
  }
}

// POL-RISK-15: 운영 시간은 정규장(09:00~15:30) 안이고 시작 < 종료예요
export class TradingHoursOutOfRangeException extends AppException {
  static readonly code = 'TRADING_HOURS_OUT_OF_RANGE';
  static readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  static readonly example = '운영 시간은 09:00~15:30 안이어야 해요.';

  constructor() {
    super(
      TradingHoursOutOfRangeException.code,
      TradingHoursOutOfRangeException.status,
      TradingHoursOutOfRangeException.example,
    );
  }
}

// 아직 전략(규칙 함수)이 없는 유형
export class BotTypeNotSupportedException extends AppException {
  static readonly code = 'BOT_TYPE_NOT_SUPPORTED';
  static readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  static readonly example = 'swing 봇은 아직 만들 수 없어요.';

  constructor(type: string) {
    super(
      BotTypeNotSupportedException.code,
      BotTypeNotSupportedException.status,
      `${type} 봇은 아직 만들 수 없어요.`,
    );
  }
}

// 규칙 값 모양이 유형별 스키마와 달라요 (FR-RAT-07). 하네스 공통 검증 실패와 같은 코드·형식이에요
export class BotParamsInvalidException extends AppException {
  static readonly code = 'VALIDATION_FAILED';
  static readonly status = HttpStatus.BAD_REQUEST;
  static readonly example = '규칙 값을 확인해 주세요.';

  constructor(errors: FieldError[]) {
    super(
      BotParamsInvalidException.code,
      BotParamsInvalidException.status,
      BotParamsInvalidException.example,
      errors,
    );
  }
}

// running·paused 봇의 투자금은 PATCH로 못 바꿔요. 쉬는 중에 rebudget 명령을 써요 (POL-FUND-12)
export class BotBudgetLockedException extends AppException {
  static readonly code = 'BOT_BUDGET_LOCKED';
  static readonly status = HttpStatus.CONFLICT;
  static readonly example =
    'running 봇의 투자금은 바꿀 수 없어요. 쉬는 중에 투자금 다시 정하기를 써요.';

  constructor(status: string) {
    super(
      BotBudgetLockedException.code,
      BotBudgetLockedException.status,
      `${status} 봇의 투자금은 바꿀 수 없어요. 쉬는 중에 투자금 다시 정하기를 써요.`,
    );
  }
}

// POL-RISK-13: 상한 해제 기준을 하나라도 못 넘었어요
export class ReleaseCriteriaNotMetException extends AppException {
  static readonly code = 'RELEASE_CRITERIA_NOT_MET';
  static readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  static readonly example =
    '상한 해제 기준을 아직 못 넘었어요: closed_trades, profit_factor';

  constructor(failed: string[]) {
    super(
      ReleaseCriteriaNotMetException.code,
      ReleaseCriteriaNotMetException.status,
      `상한 해제 기준을 아직 못 넘었어요: ${failed.join(', ')}`,
    );
  }
}

// 적용 대기 버전이 있으면 새 버전을 더 넣지 않아요 (POL-RISK-13)
export class BotVersionPendingException extends AppException {
  static readonly code = 'BOT_VERSION_PENDING';
  static readonly status = HttpStatus.CONFLICT;
  static readonly example =
    'bot 1에 적용 대기 중인 버전이 있어요. 적용된 뒤에 다시 저장해요.';

  constructor(botId: number) {
    super(
      BotVersionPendingException.code,
      BotVersionPendingException.status,
      `bot ${botId}에 적용 대기 중인 버전이 있어요. 적용된 뒤에 다시 저장해요.`,
    );
  }
}

// 지금 버전과 같은 값으로는 새 버전을 만들지 않아요
export class BotVersionUnchangedException extends AppException {
  static readonly code = 'BOT_VERSION_UNCHANGED';
  static readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  static readonly example = '지금 버전과 바뀐 값이 없어요.';

  constructor() {
    super(
      BotVersionUnchangedException.code,
      BotVersionUnchangedException.status,
      BotVersionUnchangedException.example,
    );
  }
}
