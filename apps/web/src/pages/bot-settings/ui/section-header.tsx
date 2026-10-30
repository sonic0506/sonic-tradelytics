import { Text } from '@xonic0506/sonic-ui';

// 카드 안 묶음 제목과 바로 아래 설명
export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Text as="h2" variant="body-strong">
        {title}
      </Text>
      {description && (
        <Text as="p" variant="caption" tone="muted">
          {description}
        </Text>
      )}
    </div>
  );
}
