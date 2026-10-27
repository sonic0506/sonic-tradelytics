import { STATUS_CODES } from 'node:http';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { env } from '@/config/env.js';

import { AppException, type FieldError } from '../exceptions/app.exception.js';

// RFC 9457 Problem Details + code·requestId
interface Problem {
  type: 'about:blank';
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: FieldError[];
}

const problem = (
  status: number,
  code: string,
  detail: string,
  errors?: FieldError[],
): Problem => ({
  type: 'about:blank',
  title: STATUS_CODES[status] ?? 'Error',
  status,
  detail,
  code,
  ...(errors && { errors }),
});

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const body = this.toProblem(exception);
    if (body.status >= Number(HttpStatus.INTERNAL_SERVER_ERROR))
      this.logger.error(exception);
    response
      .status(body.status)
      .type('application/problem+json')
      .json({ ...body, instance: request.originalUrl, requestId: request.id });
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof AppException)
      return problem(
        exception.status,
        exception.code,
        exception.message,
        exception.errors,
      );
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return problem(status, `HTTP_${status}`, exception.message);
    }
    // 시스템 예외: 운영에서는 내부 메시지를 숨겨요.
    const detail =
      env.NODE_ENV === 'production'
        ? '요청을 처리하지 못했어요.'
        : String(exception);
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', detail);
  }
}
