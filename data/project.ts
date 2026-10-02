/**
 * Single source of truth for all artist / project / track content.
 * Nothing in the scene or UI hardcodes track names — everything reads from here.
 */
export interface Track {
  /** 1-based track number */
  n: number
  id: string
  /** Title as displayed (without the "(Intro)" style suffix) */
  title: string
  /** Optional parenthetical, e.g. "Intro" / "Outro" */
  tag?: string
}

export interface Artwork {
  /** Optimised WebP served to WebGL / UI (resized, never edited) */
  webp: string
  avif: string
  /** The untouched official file */
  original: string
  thumb: string
  width: number
  height: number
}

export interface Project {
  id: 'alterco' | 'dualismo'
  title: string
  artwork: Artwork
  /** Facts taken from the supplied streaming screenshots */
  meta: { trackCount: number; minutes: number }
  tracks: Track[]
}

export const artist = {
  name: 'HOODDINO',
  tagline: 'Italian rap',
} as const

const t = (n: number, title: string, tag?: string): Track => ({
  n,
  id: title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title,
  tag,
})

export const alterco: Project = {
  id: 'alterco',
  title: 'ALTERCO',
  artwork: {
    webp: '/covers/alterco.webp',
    avif: '/covers/alterco.avif',
    original: '/covers/alterco-official.jpeg',
    thumb: '/covers/alterco-256.webp',
    width: 1144,
    height: 1141,
  },
  meta: { trackCount: 7, minutes: 22 },
  tracks: [
    t(1, 'Potrei', 'Intro'),
    t(2, 'We Made It'),
    t(3, 'Non è Swag'),
    t(4, 'Giudizio Divino'),
    t(5, 'Lasciarsi Andare'),
    t(6, 'Parole Contrastanti'),
    t(7, 'Stare Bene', 'Outro'),
  ],
}

export const dualismo: Project = {
  id: 'dualismo',
  title: 'DUALISMO',
  artwork: {
    webp: '/covers/dualismo.webp',
    avif: '/covers/dualismo.avif',
    original: '/covers/dualismo-official.jpeg',
    thumb: '/covers/dualismo-256.webp',
    width: 493,
    height: 490,
  },
  meta: { trackCount: 2, minutes: 5 },
  tracks: [t(1, 'Chirone'), t(2, 'Messaggio')],
}

export const trackLabel = (tr: Track) => (tr.tag ? `${tr.title} (${tr.tag})` : tr.title)
export const pad = (n: number) => String(n).padStart(2, '0')
