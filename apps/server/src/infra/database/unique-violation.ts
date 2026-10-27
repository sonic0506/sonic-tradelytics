import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505'; // PostgreSQL unique_violation

// unique 제약 위반(중복 이메일 등)인지 확인해요. repository가 잡아 null·false로 돌려주고, service가 409 예외로 바꿔요(harness.md 4절).
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    error.driverError instanceof Error &&
    'code' in error.driverError &&
    error.driverError.code === UNIQUE_VIOLATION
  );
}
