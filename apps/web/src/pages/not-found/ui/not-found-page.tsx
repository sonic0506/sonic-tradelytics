import { buttonVariants, ErrorPage } from '@xonic0506/sonic-ui';
import NextLink from 'next/link';

export function NotFoundPage() {
  return (
    <ErrorPage
      status={404}
      action={
        <NextLink href="/" className={buttonVariants()}>
          홈으로 가기
        </NextLink>
      }
    />
  );
}
