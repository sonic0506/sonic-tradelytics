// TossClient가 던지는 오류예요. 호출하는 쪽은 status·code로 처리를 나눠요(docs/architecture/order-lifecycle.md 에러별 처리).

// 토스가 에러 envelope으로 응답했어요. code는 토스 에러 코드(예: opposite-pending-order-exists)
export class TossApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly data?: unknown,
    readonly requestId?: string,
  ) {
    super(`토스 API ${status} ${code}: ${message}`);
  }
}

// 응답을 받지 못했어요(타임아웃·네트워크). 주문이면 접수됐는지 알 수 없어요(응답을 못 받았을 때 절)
export class TossNoResponseError extends Error {
  constructor(
    readonly path: string,
    cause: unknown,
  ) {
    super(`토스 API 응답 없음: ${path}`, { cause });
  }
}

// 호출 한도가 남지 않아 보내지 않았어요. 판단용 호출은 이걸 받으면 "건너뛴 판단"(rate_limit)으로 남겨요
export class TossRateLimitedError extends Error {
  constructor(readonly group: string) {
    super(`토스 API 호출 한도 부족: ${group}`);
  }
}

// engine 설정(TOSS_* 환경 변수)이 비어 있어요
export class TossConfigError extends Error {}
