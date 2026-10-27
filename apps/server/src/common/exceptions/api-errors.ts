import { STATUS_CODES } from 'node:http';

import { HttpStatus } from '@nestjs/common';
import {
  ApiExtension,
  getSchemaPath,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { z } from 'zod';

import type { FieldError } from './app.exception.js';
import { ProblemDetailsDto } from './problem-details.dto.js';

// Swagger에 적는 비즈니스 예외예요. 예외 클래스의 static code·status·example을 읽어요(harness.md 2절).
export interface DocumentedException {
  readonly code: string;
  readonly status: HttpStatus;
  /** Swagger 예시에 보여 줄 detail */
  readonly example: string;
}

// 데코레이터는 OpenAPI 확장 필드에 표시만 하고, addErrorResponses가 문서를 만들 때 응답으로 바꿔요.
export const ERRORS_EXTENSION = 'x-errors';
export const PUBLIC_EXTENSION = 'x-public';
export const ROLES_EXTENSION = 'x-roles';

/** handler가 던질 수 있는 비즈니스 예외를 Swagger 에러 응답과 예시로 적어요. handler마다 한 번만 붙여요. */
export const ApiErrors = (
  ...exceptions: DocumentedException[]
): MethodDecorator & ClassDecorator =>
  ApiExtension(
    ERRORS_EXTENSION,
    exceptions.map(({ status, code, example }) => ({
      status,
      code,
      detail: example,
    })),
  );

interface ErrorExample {
  status: number;
  code: string;
  detail: string;
  errors?: FieldError[];
}

// 전역 ValidationPipe·ParseIntPipe·JwtAuthGuard·RolesGuard가 내는 에러예요. 문구는 실제 응답과 같아요.
const COMMON_ERRORS = {
  validation: {
    status: HttpStatus.BAD_REQUEST,
    code: 'VALIDATION_FAILED',
    detail: '요청 값이 올바르지 않아요.',
    errors: [{ field: 'name', messages: ['name should not be empty'] }],
  },
  pathParam: {
    status: HttpStatus.BAD_REQUEST,
    code: `HTTP_${HttpStatus.BAD_REQUEST}`,
    detail: 'Validation failed (numeric string is expected)',
  },
  unauthorized: {
    status: HttpStatus.UNAUTHORIZED,
    code: `HTTP_${HttpStatus.UNAUTHORIZED}`,
    detail: 'Unauthorized',
  },
  forbidden: {
    status: HttpStatus.FORBIDDEN,
    code: `HTTP_${HttpStatus.FORBIDDEN}`,
    detail: 'Forbidden resource',
  },
} satisfies Record<string, ErrorExample>;

const extensionsSchema = z.object({
  [ERRORS_EXTENSION]: z
    .array(
      z.object({ status: z.number(), code: z.string(), detail: z.string() }),
    )
    .default([]),
  [PUBLIC_EXTENSION]: z.boolean().default(false),
  [ROLES_EXTENSION]: z.array(z.string()).default([]),
});

// @nestjs/swagger가 OpenAPI 하위 타입을 내보내지 않아서 OpenAPIObject에서 꺼내요.
type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>;
type ResponseObject = Exclude<
  NonNullable<OperationObject['responses'][string]>,
  { $ref: string }
>;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const PROBLEM_JSON = 'application/problem+json';

// 공통 에러(400·401·403)를 자동으로, @ApiErrors로 적은 비즈니스 에러를 더해 에러 응답과 예시를 만들어요.
// - 400: body·query가 있으면 VALIDATION_FAILED, 숫자 path 파라미터가 있으면 HTTP_400(ParseIntPipe)
// - 401: @Public()이 아니면. @Public()이면 security를 비워 Swagger UI에 자물쇠가 나오지 않아요
// - 403: @Roles()가 있으면
export function addErrorResponses(document: OpenAPIObject): void {
  for (const [path, item] of Object.entries(document.paths))
    for (const method of METHODS) {
      const operation = item[method];
      if (operation) addToOperation(path, operation);
    }
}

function addToOperation(path: string, operation: OperationObject): void {
  const extensions = extensionsSchema.parse(operation);
  for (const key of [ERRORS_EXTENSION, PUBLIC_EXTENSION, ROLES_EXTENSION])
    Reflect.deleteProperty(operation, key);

  const parameters = (operation.parameters ?? []).filter((p) => 'in' in p);
  const hasQuery = parameters.some((p) => p.in === 'query');
  // ParseIntPipe를 쓴 숫자 path 파라미터(id: number)만 400이 나요.
  const hasNumberPath = parameters.some(
    (p) =>
      p.in === 'path' &&
      p.schema &&
      'type' in p.schema &&
      (p.schema.type === 'number' || p.schema.type === 'integer'),
  );
  const errors: ErrorExample[] = [];
  if (operation.requestBody || hasQuery) errors.push(COMMON_ERRORS.validation);
  if (hasNumberPath) errors.push(COMMON_ERRORS.pathParam);
  if (extensions[PUBLIC_EXTENSION]) operation.security = [];
  else errors.push(COMMON_ERRORS.unauthorized);
  if (extensions[ROLES_EXTENSION].length) errors.push(COMMON_ERRORS.forbidden);
  errors.push(...extensions[ERRORS_EXTENSION]);

  for (const error of errors) {
    const response = (operation.responses[error.status] ??= {
      description: STATUS_CODES[error.status] ?? 'Error',
    });
    if (!('description' in response)) continue;
    exampleMap(response)[error.code] = {
      summary: error.detail,
      value: {
        type: 'about:blank',
        title: STATUS_CODES[error.status] ?? 'Error',
        status: error.status,
        detail: error.detail,
        code: error.code,
        instance: path.replace(/\{\w+\}/g, '1'),
        requestId: '5f1c2a0e-8d6b-4c3e-9a7f-2b4d6e8f0a1c',
        ...(error.errors && { errors: error.errors }),
      },
    };
  }
}

function exampleMap(response: ResponseObject): Record<string, object> {
  response.content ??= {};
  const media = (response.content[PROBLEM_JSON] ??= {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  });
  return (media.examples ??= {});
}
