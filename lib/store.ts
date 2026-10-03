import { create } from 'zustand'
import { alterco } from '@/data/project'
import { detectTier, type Tier } from './quality'

export type CursorKind = 'default' | 'link' | 'track' | 'portal' | 'lamp' | 'drag' | 'text' | 'explore'
export type Mode = 'alterco' | 'dualism-in' | 'dualism' | 'dualism-out'

interface Toast {
  id: number
  text: string
  sub?: string
}

interface State {
  phase: 'loading' | 'ready' | 'entered' | 'nogl'
  loadProgress: number
  sound: boolean
  tier: Tier
  mode: Mode
  /** progress points (0..1) already passed, for UI */
  scene: string
  selected: number | null
  front: number
  visited: number[]
  dualismoFound: boolean
  dualismoTrack: number | null
  cursor: { kind: CursorKind; label?: string }
  toast: Toast | null
  creditsOpen: boolean
  letters: boolean[]
  /** the 01–07 trail on physical objects (never shown as a counter) */
  nums: boolean[]
  /** DUALISMO visited and returned from → the street remembers */
  dualReturned: boolean
  lamp: boolean
  whisper: string | null
  hoodClicks: number
  menu: boolean
  /** ids of discovered Easter eggs (lamp, puddle, stencil, letters, credits, portal, hood, glitch, tracks) */
  eggs: string[]

  set: (p: Partial<State>) => void
  setCursor: (kind: CursorKind, label?: string) => void
  say: (text: string, sub?: string) => void
  visit: (i: number) => void
  markEgg: (id: string) => void
}

let toastId = 0

export const useStore = create<State>((set, get) => ({
  phase: 'loading',
  loadProgress: 0,
  sound: false,
  tier: 'medium',
  mode: 'alterco',
  scene: 'alley',
  selected: null,
  front: 0,
  visited: [],
  dualismoFound: false,
  dualismoTrack: null,
  cursor: { kind: 'default' },
  toast: null,
  creditsOpen: false,
  letters: new Array(7).fill(false),
  nums: new Array(7).fill(false),
  dualReturned: false,
  lamp: true,
  whisper: null,
  hoodClicks: 0,
  menu: false,
  eggs: [],

  set: (p) => set(p),
  setCursor: (kind, label) => {
    const c = get().cursor
    if (c.kind !== kind || c.label !== label) set({ cursor: { kind, label } })
  },
  say: (text, sub) => {
    const id = ++toastId
    set({ toast: { id, text, sub } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 4200)
  },
  markEgg: (id) => {
    const e = get().eggs
    if (!e.includes(id)) set({ eggs: [...e, id] })
  },
  visit: (i) => {
    const v = get().visited
    if (!v.includes(i)) set({ visited: [...v, i] })
  },
}))

export const TRACK_COUNT = alterco.tracks.length
export { detectTier }
