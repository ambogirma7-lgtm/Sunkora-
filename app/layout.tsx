import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sankora Land Registration Bot & Management Portal',
  description: 'Telegram Bot and administration system for registering interested residential land members in Sankora Town with Firebase and Google Sheets sync.',
  openGraph: {
    title: 'Sankora Land Registration Bot & Management Portal',
    description: 'Telegram Bot and administration system for registering interested residential land members in Sankora Town with Firebase and Google Sheets sync.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sankora Land Registration Bot & Management Portal',
    description: 'Telegram Bot and administration system for registering interested residential land members in Sankora Town with Firebase and Google Sheets sync.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="am" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
