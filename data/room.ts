import { withBase } from '@/lib/base'

/**
 * THE HOODDINO ROOM — every word and URL that appears in the room lives here.
 * Nothing below is invented: the biography and the three links are the ones supplied by the artist's team.
 */
export const roomBio = {
  /** exact supplied text — do not edit, extend or paraphrase */
  paragraph:
    'HOODDINO — classe 2005, dalla provincia sud di Torino. Liricista suburbano, tecnico e spirituale. Tra gli studi di Re-Akt a San Donato e i palchi della scena underground torinese, HOODDINO costruisce una scrittura in cui tecnica, introspezione e periferia convivono. A settembre arriva ALTERCO, il suo primo disco indipendente.',
  headline: ['WHO IS', 'HOODDINO?'],
  meta: ['2005 / SOUTH OF TURIN', 'LIRICISTA SUBURBANO / TECNICO / SPIRITUALE'],
} as const

export const roomLinks = {
  spotify: { label: 'SPOTIFY', url: 'https://open.spotify.com/artist/6ETJU37OTsdfeTeDMN7oKI' },
  instagram: { label: 'INSTAGRAM', url: 'https://www.instagram.com/hoodddddddd' },
  tiktok: { label: 'TIKTOK', url: 'https://www.tiktok.com/@hooddddddddd' },
} as const
export type RoomLinkId = keyof typeof roomLinks

/** artist media (derivatives produced by scripts/optimize-room-media.sh from the supplied pack) */
export const roomMedia = {
  portrait: { lo: withBase('/room/portrait-lo.webp'), hi: withBase('/room/portrait-hi.webp') },
  live: { lo: withBase('/room/live-lo.webp'), hi: withBase('/room/live-hi.webp') },
  signal: { lo: withBase('/room/signal-lo.webp'), hi: withBase('/room/signal-hi.webp') },
  poster: withBase('/room/studio-poster.webp'),
  video: withBase('/room/hooddino-studio-arrangiamento.mp4'),
  videoDuration: 56.07,
} as const

export const roomCopy = {
  title: 'THE HOODDINO ROOM',
  videoLabel: ['IN THE STUDIO', 'ARRANGIAMENTO', 'PLAY →'],
  live: ['LIVE DATES', 'UPDATED ON INSTAGRAM ↗'],
} as const
