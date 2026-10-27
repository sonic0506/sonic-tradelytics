import './globals.css';

import type { Metadata } from 'next';

import { AppProviders } from '@/app/providers';

export const metadata: Metadata = {
  title: 'sonic-tradelytics',
  description: '근거·예측·결과가 남는 단타 봇',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" data-theme="light">
      <body className="bg-canvas font-sans text-default">
        <div className="isolate">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
