import { env } from '@/shared/config';

// 서버(서버 컴포넌트의 prefetch)에서는 절대 주소가 필요해요. 브라우저는 같은 출처의 /api를 써요.
const ORIGIN = typeof window === 'undefined' ? env.API_ORIGIN : '';
export const API_BASE_URL = `${ORIGIN}/api`;

export class HttpError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string) {
    super(`${status} ${path}`);
    this.status = status;
    this.path = path;
  }
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new HttpError(response.status, path);
  if (response.status === 204) return undefined as T; // 본문 없는 응답(DELETE 등): http<void>(…)
  return (await response.json()) as T;
}
