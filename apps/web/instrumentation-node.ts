import { server } from '@/app/mocks/server';
import { env } from '@/shared/config';

if (env.NEXT_PUBLIC_API_MOCKING === 'true') {
  server.listen({ onUnhandledFrame: 'bypass' });
}
