import { withBase } from '@/lib/base'
import type { Metadata, Viewport } from 'next'
import '@fontsource/anton/latin-400.css'
import '@fontsource/anton/latin-ext-400.css'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-700.css'
// street-typography families (canvas only — never used for UI text). Latin subset, single weight each; see README → Fonts & licences.
import '@fontsource/permanent-marker/latin-400.css'
import '@fontsource/reenie-beanie/latin-400.css'
import '@fontsource/rock-salt/latin-400.css'
import '@fontsource/titan-one/latin-400.css'
import '@fontsource/bungee/latin-400.css'
import '@fontsource/saira-stencil-one/latin-400.css'
import '@fontsource/playfair-display/latin-900-italic.css'
import '@fontsource/nanum-pen-script/latin-400.css'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'HOODDINO — ALTERCO',
  description: 'ALTERCO, the 7-track project by HOODDINO — an interactive WebGL journey from the alley to the rooftop. DUALISMO is hidden somewhere inside.',
  openGraph: {
    title: 'HOODDINO — ALTERCO',
    description: 'Walk through the world of ALTERCO.',
    images: [{ url: withBase('/covers/alterco.webp'), width: 1144, height: 1141 }],
    type: 'music.album',
  },
  icons: { icon: withBase('/covers/alterco-256.webp') },
}

export const viewport: Viewport = {
  themeColor: '#050506',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
