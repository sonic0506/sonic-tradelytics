import { Text } from '@xonic0506/sonic-ui';

export function Brand() {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <Text variant="body-strong">Sonic Tradelytics</Text>
      <Text variant="caption" tone="muted">
        자동매매 대시보드
      </Text>
    </div>
  );
}
