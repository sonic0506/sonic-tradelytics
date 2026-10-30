import { Text } from '@xonic0506/sonic-ui';

type SectionHeaderProps = {
  id?: string;
  title: string;
  description?: string;
};

// 카드 안 묶음 제목과 바로 아래 설명 (Figma Bot Create Section / Header)
export function SectionHeader({ id, title, description }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <Text as="h2" variant="body-strong" {...(id ? { id } : {})}>
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
