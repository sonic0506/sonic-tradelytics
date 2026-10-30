import { buttonVariants, ErrorPage } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

// 없는 거래 (Figma Rationale / 404는 봇 404와 같은 모양)
export function PositionNotFound() {
  return (
    <ErrorPage
      status={404}
      title="거래를 찾을 수 없어요"
      description="주소가 바뀌었거나 없는 거래예요. 투자 내역에서 다시 찾아 주세요."
      action={
        <NextLink href="/history" className={buttonVariants()}>
          투자 내역으로 가기
        </NextLink>
      }
    />
  );
}
