import {
  ClsPluginTransactional,
  NoOpTransactionalAdapter,
} from '@nestjs-cls/transactional';
import type { TestingModule } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';

// @Transactional()을 쓰는 service를 단위 테스트할 때 imports에 더해요.
// 실제 트랜잭션은 시작하지 않아요(트랜잭션 동작은 e2e에서 실제 DB로 확인해요).
export const noOpTransactionalModule = ClsModule.forRoot({
  global: true,
  plugins: [
    new ClsPluginTransactional({
      adapter: new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }),
    }),
  ],
});

// @Transactional()은 CLS 컨텍스트 안에서만 동작해서, 호출을 이 함수로 감싸요.
export function runInCls<T>(
  moduleRef: TestingModule,
  fn: () => Promise<T>,
): Promise<T> {
  return moduleRef.get(ClsService).run(fn);
}
