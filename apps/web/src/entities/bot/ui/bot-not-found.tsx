import { buttonVariants, ErrorPage } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

// 없는 봇 (Figma Bot Detail / 404)
export function BotNotFound() {
  return (
    <ErrorPage
      status={404}
      title="봇을 찾을 수 없어요"
      description="주소가 바뀌었거나 지운 봇이에요. 봇 목록에서 다시 찾아 주세요."
      action={
        <NextLink href="/bots" className={buttonVariants()}>
          봇 목록으로 가기
        </NextLink>
      }
    />
  );
}
