import type { Metadata } from 'next';
import './globals.css';
import { SettingsProvider } from '../hooks/useSettings';

export const metadata: Metadata = {
  title: 'Al-Noor Supermarket & Retail POS',
  description: 'Production Retail POS, Inventory & Management System for Saudi Arabia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
