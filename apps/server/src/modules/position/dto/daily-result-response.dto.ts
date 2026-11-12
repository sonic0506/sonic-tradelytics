export class DailyResultResponseDto {
  /** 거래일 (YYYY-MM-DD) */
  tradeDate: string;

  /** 그날 실현 손익(수수료·세금 차감) + 장 마감 평가 손익의 합 */
  pnl: number;

  /** 수수료 + 세금 */
  fees: number;

  /** 청산한 거래 수 (한 주도 체결되지 않은 진입은 빼요) */
  closedTrades: number;

  // service의 DailyTotal과 같은 모양이에요 (dto는 service를 가져오지 않아요)
  static from(total: DailyResultResponseDto): DailyResultResponseDto {
    const dto = new DailyResultResponseDto();
    dto.tradeDate = total.tradeDate;
    dto.pnl = total.pnl;
    dto.fees = total.fees;
    dto.closedTrades = total.closedTrades;
    return dto;
  }
}

export class DailyResultListDto {
  items: DailyResultResponseDto[];
}
