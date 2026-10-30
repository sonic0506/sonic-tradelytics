import { Suspense } from 'react';

import { HomeDashboard, HomeSkeleton } from './home-dashboard';
import { HomePrefetch } from './home-prefetch';

export function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomePrefetch>
        <HomeDashboard />
      </HomePrefetch>
    </Suspense>
  );
}
