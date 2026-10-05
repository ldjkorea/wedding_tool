import { getThemeStyle, getClientContent, getStudioConfig } from '@/services/configuration';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: getClientContent().metadata.title,
  description: getClientContent().metadata.description,
  icons: {
    icon: getStudioConfig().logo,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" style={getThemeStyle() as React.CSSProperties}>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-screen bg-[rgb(var(--studio-background))] text-[rgb(var(--studio-primary))] flex flex-col font-sans selection:bg-[rgb(var(--studio-border))]">
        {children}
      </body>
    </html>
  );
}
