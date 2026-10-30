import { Card, Skeleton } from '@xonic0506/sonic-ui';

// 근거 카드를 처음 불러오는 동안 (Figma Rationale / 로딩)
export function PositionRationaleSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="h-10 w-48" />
        <Skeleton shape="text" className="w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="gap-2">
            <Skeleton shape="text" className="w-16" />
            <Skeleton shape="text" className="h-7 w-20" />
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-4">
        <Card className="gap-3 lg:col-span-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} shape="rect" className="h-10" />
          ))}
        </Card>
        <Card className="gap-3 lg:col-span-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} shape="text" />
          ))}
        </Card>
      </div>
    </div>
  );
}
