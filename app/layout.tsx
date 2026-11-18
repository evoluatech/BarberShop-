import type {Metadata, Viewport} from 'next';
import {Outfit, Plus_Jakarta_Sans, JetBrains_Mono} from 'next/font/google';
import {AuthModal} from '@/components/AuthModal';
import {FirebaseErrorBoundary} from '@/components/FirebaseErrorBoundary';
import {FirebaseProvider} from '@/components/FirebaseProvider';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-outfit',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Barber Shop — Agendamento e Estilo',
  description:
    'Na Barber Shop, cada corte é pensado para valorizar o seu estilo. Veja serviços, preços, profissionais, simulação virtual e agende seu horário.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Barber Shop',
  },
  icons: {
    icon: [
      {url: '/favicon.png', sizes: '64x64', type: 'image/png'},
      {url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png'},
    ],
    apple: [{url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png'}],
  },
  openGraph: {
    title: 'Barber Shop — Agendamento e Estilo',
    description:
      'Cortes modernos, barba, acabamento e atendimento personalizado. Agende seu horário online.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Barber Shop — Agendamento e Estilo',
    description:
      'Cortes modernos, barba, acabamento e atendimento personalizado. Agende seu horário online.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#111111] text-white font-sans antialiased selection:bg-[#F7931E] selection:text-[#111111]"
      >
        <FirebaseErrorBoundary>
          <FirebaseProvider>
            {children}
            <AuthModal />
          </FirebaseProvider>
        </FirebaseErrorBoundary>
      </body>
    </html>
  );
}
