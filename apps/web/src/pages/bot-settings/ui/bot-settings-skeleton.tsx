import { Card, Skeleton } from '@xonic0506/sonic-ui';

// 봇 설정을 처음 불러오는 동안 (Figma Bot Settings / 로딩)
export function BotSettingsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Skeleton shape="text" className="w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="h-10 w-40" />
        <Skeleton shape="text" className="w-80 max-w-full" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-4">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="gap-4 p-6">
            <Skeleton shape="text" className="w-24" />
            <Skeleton shape="rect" className="h-8" />
            <Skeleton shape="rect" className="h-8" />
            <Skeleton shape="rect" className="h-8" />
          </Card>
          <Card className="gap-4 p-6">
            <Skeleton shape="text" className="w-24" />
            <Skeleton shape="rect" className="h-8" />
          </Card>
        </div>
        <Card className="gap-3">
          <Skeleton shape="text" className="w-20" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} shape="text" />
          ))}
        </Card>
      </div>
    </div>
  );
}
