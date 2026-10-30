import type { ReactNode } from 'react';

import { QueryBoundary } from '@/shared/ui';

import { Brand } from './brand';
import { EngineBanner } from './engine-banner';
import { EngineStatusBadge } from './engine-status-badge';
import { EngineStatusHydration } from './engine-status-hydration';
import {
  EngineStatusPanel,
  EngineStatusPanelSkeleton,
} from './engine-status-panel';
import { NavList } from './nav-list';
import { TopBar } from './top-bar';

const ENGINE_ERROR = '엔진 상태를 불러오지 못했어요';

// 모든 화면의 틀: 데스크톱은 왼쪽 내비(240), 좁은 화면은 TopBar. 본문은 최대 960(DESIGN.md §4).
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 border-r border-default bg-surface p-4 max-sm:hidden">
        <Brand />
        <NavList />
        <div className="mt-auto">
          <QueryBoundary
            loading={<EngineStatusPanelSkeleton />}
            errorTitle={ENGINE_ERROR}
            isCompact
          >
            <EngineStatusHydration>
              <EngineStatusPanel />
            </EngineStatusHydration>
          </QueryBoundary>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          engineStatus={
            <QueryBoundary
              loading={null}
              errorTitle={ENGINE_ERROR}
              errorFallback={null}
            >
              <EngineStatusHydration>
                <EngineStatusBadge />
              </EngineStatusHydration>
            </QueryBoundary>
          }
        />
        <main className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 py-10 max-sm:py-6">
          <QueryBoundary
            loading={null}
            errorTitle={ENGINE_ERROR}
            errorFallback={null}
          >
            <EngineStatusHydration>
              <EngineBanner />
            </EngineStatusHydration>
          </QueryBoundary>
          {children}
        </main>
      </div>
    </div>
  );
}
