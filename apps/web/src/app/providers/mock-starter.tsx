'use client';

import { useEffect } from 'react';

import { releaseRequests } from '@/shared/api';
import { env } from '@/shared/config';

// 개발 화면 StrictMode는 effect를 두 번 실행하고, MSW는 두 번 시작하면 에러가 나서 한 번만 시작해요.
let isStarted = false;

// 개발 화면에서 브라우저 요청을 MSW로 받아요. 켜질 때까지 http() 요청은 기다려요(app-providers).
// 켜지지 못해도 요청을 놓아줘서 화면이 멈춰 있지 않게 해요.
export function MockStarter() {
  useEffect(() => {
    if (env.NEXT_PUBLIC_API_MOCKING !== 'true' || isStarted) return;
    isStarted = true;
    void import('../mocks/browser')
      .then(({ worker }) => worker.start({ onUnhandledFrame: 'bypass' }))
      .finally(releaseRequests);
  }, []);
  return null;
}
