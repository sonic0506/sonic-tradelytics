import { Card, Skeleton } from '@xonic0506/sonic-ui';

// 봇 상세를 받는 동안 같은 배치로 자리만 보여 줘요(DESIGN.md §8).
export function BotDetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton shape="rect" className="size-16" />
        <div className="flex flex-col gap-2">
          <Skeleton shape="text" className="h-8 w-48" />
          <Skeleton shape="text" className="w-80 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((kpi) => (
          <Card key={kpi}>
            <Skeleton shape="text" className="w-20" />
            <Skeleton shape="text" className="h-6 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
        <Card className="lg:col-span-3">
          <Skeleton shape="rect" className="h-80" />
        </Card>
        <Card className="lg:col-span-2">
          <Skeleton shape="rect" className="h-80" />
        </Card>
      </div>
    </div>
  );
}
