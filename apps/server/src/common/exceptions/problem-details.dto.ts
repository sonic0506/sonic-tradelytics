export class FieldErrorDto {
  /** 요청 필드 이름 */
  field: string;
  messages: string[];
}

// RFC 9457 에러 응답 형식이에요(전역 필터 AppExceptionFilter). Swagger의 모든 에러 응답이 이 스키마를 써요.
export class ProblemDetailsDto {
  /** 늘 about:blank */
  type: string;
  /** HTTP 상태 이름(예: Not Found) */
  title: string;
  status: number;
  /** 사람이 읽는 설명 */
  detail: string;
  /** 에러 코드. 클라이언트는 이 값으로 분기해요(예: ORDER_ITEM_NOT_FOUND). */
  code: string;
  /** 요청 경로 */
  instance: string;
  /** 요청 ID(X-Request-Id). 로그를 찾을 때 써요. */
  requestId: string;
  /** 검증 실패(VALIDATION_FAILED)일 때 필드별 메시지 */
  errors?: FieldErrorDto[];
}
