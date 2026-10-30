import { env } from '@/shared/config';

// 서버(서버 컴포넌트의 prefetch)에서는 절대 주소가 필요해요. 브라우저는 같은 출처의 /api를 써요.
const ORIGIN = typeof window === 'undefined' ? env.API_ORIGIN : '';
export const API_BASE_URL = `${ORIGIN}/api`;

export class HttpError extends Error {
  readonly status: number;
  readonly path: string;
  // 서버가 알려 준 실패 이유. 에러 몸체 { code }에서 읽어요(api.md 공통 규칙)
  readonly code: string | null;

  constructor(status: number, path: string, code: string | null = null) {
    super(`${status} ${path}`);
    this.status = status;
    this.path = path;
    this.code = code;
  }
}

async function readErrorCode(response: Response) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
    ) {
      return body.code;
    }
  } catch {
    // 몸체가 JSON이 아니면 이유 없이 넘겨요.
  }
  return null;
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new HttpError(response.status, path, await readErrorCode(response));
  }
  if (response.status === 204) return undefined as T; // 본문 없는 응답(DELETE 등): http<void>(…)
  return (await response.json()) as T;
}
