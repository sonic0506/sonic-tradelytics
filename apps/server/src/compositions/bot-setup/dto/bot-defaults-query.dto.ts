import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import {
  BOT_TYPES,
  type BotType,
  RISK_PROFILES,
  type RiskProfile,
} from '@/modules/bot/index.js';

export class BotDefaultsQueryDto {
  /** 봇 유형 */
  @ApiProperty({ enum: BOT_TYPES })
  @IsIn(BOT_TYPES)
  type: BotType;

  /** 투자 성향 */
  @ApiProperty({ enum: RISK_PROFILES })
  @IsIn(RISK_PROFILES)
  riskProfile: RiskProfile;
}
