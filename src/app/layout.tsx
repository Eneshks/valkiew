import type { Metadata, Viewport } from 'next';
import { GAME_NAME } from '@/config/game';
import './globals.css';

export const metadata: Metadata = {
  title: `${GAME_NAME} — Mafya Şehri`,
  description: 'Tarayıcıda oynanan mafya oyunu. Sokaklardan başla, şehrin babası ol.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: GAME_NAME, statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f0d0b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
