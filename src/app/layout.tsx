import type { Metadata, Viewport } from 'next';
import './globals.css';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Is It AI? Spot scams made with AI',
  description: 'A free, simple way for adults 60+ to practise recognizing and responding to scams made with AI.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4e89',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Atkinson Hyperlegible Next separates look-alike characters (I, l, 1 and O, 0). If it cannot load, system fonts are used. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
