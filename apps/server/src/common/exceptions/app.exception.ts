import type { HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  messages: string[];
}

// 비즈니스 예외의 기본 클래스예요. feature마다 *.exception.ts에서 상속해요.
// 전역 필터(AppExceptionFilter)가 code·status로 표준 에러 응답을 만들어요.
export class AppException extends Error {
  constructor(
    readonly code: string,
    readonly status: HttpStatus,
    message: string,
    readonly errors?: FieldError[],
  ) {
    super(message);
  }
}
