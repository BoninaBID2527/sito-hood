import type { Metadata, Viewport } from 'next'
import '@fontsource/anton/latin-400.css'
import '@fontsource/anton/latin-ext-400.css'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-700.css'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'HOODDINO — ALTERCO',
  description: 'ALTERCO, the 7-track project by HOODDINO — an interactive WebGL journey from the alley to the rooftop. DUALISMO is hidden somewhere inside.',
  openGraph: {
    title: 'HOODDINO — ALTERCO',
    description: 'Walk through the world of ALTERCO.',
    images: [{ url: '/covers/alterco.webp', width: 1144, height: 1141 }],
    type: 'music.album',
  },
  icons: { icon: '/covers/alterco-256.webp' },
}

export const viewport: Viewport = {
  themeColor: '#050506',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
