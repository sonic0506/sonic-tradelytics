import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// 목록 조회 API는 이 DTO로 page·size를 받아요. repository에는 take: size로 넘겨요.
// 기본값이 있어 선택 값이에요. 초기값만 있으면 Swagger 플러그인이 타입을 Object, 필수로 읽어서 직접 적어요.
export class PageQueryDto {
  /** 페이지(1부터) */
  @ApiPropertyOptional({ type: Number, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** 페이지 크기(최대 100) */
  @ApiPropertyOptional({ type: Number, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;

  get skip(): number {
    return (this.page - 1) * this.size;
  }
}
