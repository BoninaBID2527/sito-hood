import { rng } from '@/lib/math'
import type { WindowVariant } from '@/lib/textures'
import { plazaArchWindows } from './plazaLayout'

export type BrickKind = 'red' | 'dark' | 'weathered' | 'plaster' | 'concrete'

export interface Seg {
  side: -1 | 1
  z0: number // near (larger z)
  z1: number // far
  hw: number // half-width at this segment (distance of wall from the centre line)
  h: number
  kind: BrickKind
  tint: string
}

const L: [number, number, number, number, BrickKind, string][] = [
  [30, 12, 3.05, 24, 'red', '#d8c0b0'],
  [12, -6, 2.95, 22, 'plaster', '#e0d2c4'],
  [-6, -24, 3.4, 26, 'dark', '#d0c4be'],
  [-24, -42, 3.0, 23, 'weathered', '#e2cdb8'],
  [-42, -58, 3.7, 25, 'red', '#c8b0a4'],
  [-58, -76, 4.8, 24, 'concrete', '#d4cec6'],
]
const R: [number, number, number, number, BrickKind, string][] = [
  [30, 10, 3.1, 25, 'dark', '#d4c4bc'],
  [10, -10, 3.3, 23, 'red', '#e4cdbd'],
  [-10, -27, 2.9, 26, 'plaster', '#d8ccc0'],
  [-27, -44, 3.2, 24, 'red', '#cdb4a6'],
  [-44, -60, 3.0, 22, 'weathered', '#e0c8b2'],
  [-60, -76, 4.3, 25, 'dark', '#cfc2ba'],
]

export const SEGS: Seg[] = [
  ...L.map(([z0, z1, hw, h, kind, tint]) => ({ side: -1 as const, z0, z1, hw, h, kind, tint })),
  ...R.map(([z0, z1, hw, h, kind, tint]) => ({ side: 1 as const, z0, z1, hw, h, kind, tint })),
]

export function segAt(side: -1 | 1, z: number): Seg {
  return SEGS.find((s) => s.side === side && z <= s.z0 && z >= s.z1) ?? SEGS.filter((s) => s.side === side)[0]
}
/** x coordinate of the wall surface at depth z (alley, then plaza). */
export const wallX = (side: -1 | 1, z: number) => (z < PLAZA.z0 ? side * PLAZA.hw : side * segAt(side, z).hw)

/** Plaza walls (beyond the alley mouth). */
export const PLAZA = {
  z0: -76,
  z1: -118,
  hw: 12,
}

/** Installed service access: corner entries and the central track-power bays. */
export const plazaServiceDoors = (side: -1 | 1) => [side === -1 ? -80.2 : -116.2, -102]

/** Window grid per wall segment, deterministic. */
export interface WinInst {
  side: -1 | 1
  x: number
  y: number
  z: number
  variant: WindowVariant
  w: number
  h: number
  /** per-instance brightness (lit windows vary a lot) */
  tone?: number
  /** V3.7: a window on a wall that faces +z (rear blocks); x/y/z is then the wall-face position */
  face?: 'z' | 'back'
}

/** Weighted table: most windows are dead or covered; a few are alive. */
const TABLE: [WindowVariant, number][] = [
  ['dark', 0.2], ['warm', 0.08], ['warm2', 0.06], ['cool', 0.025], ['tv', 0.03], ['blind', 0.12], ['boarded', 0.07],
  ['barred', 0.08], ['sheet', 0.06], ['shutter', 0.1], ['broken', 0.04], ['ac', 0.075],
]
export function pickWindow(r: () => number): WindowVariant {
  let x = r()
  for (const [v, w] of TABLE) { if ((x -= w) < 0) return v }
  return 'dark'
}

export function windowsFor(seg: Seg, seed: number, skipZ: number[] = []): WinInst[] {
  const r = rng(seed)
  const out: WinInst[] = []
  const pitch = 3.0
  for (let z = seg.z0 - 1.4; z > seg.z1 + 1.0; z -= pitch) {
    if (skipZ.some((s) => Math.abs(s - z) < 1.8)) continue
    // each column has its own character: some stacks are mostly alive, some mostly dead, a few are bricked up
    const colMood = r()
    const bricked = r() < 0.07
    for (let k = 0; k < 6; k++) {
      const y = 5.3 + k * 3.35 + (r() - 0.5) * 0.16
      if (y > seg.h - 2) break
      if (bricked && k > 0) continue
      if (r() < 0.06) continue
      let variant = pickWindow(r)
      if (colMood > 0.78 && r() < 0.5) variant = r() < 0.6 ? 'warm' : 'warm2'
      if (colMood < 0.2 && (variant === 'warm' || variant === 'warm2')) variant = 'blind'
      out.push({ side: seg.side, x: seg.side * seg.hw, y, z: z + (r() - 0.5) * 0.5, variant, w: 0.88 + r() * 0.3, h: 0.92 + r() * 0.34, tone: 0.28 + Math.pow(r(), 1.4) * 1.1 })
    }
  }
  return out
}

/** zones kept clear of doors / shutters (landmarks: studio door, fire-escape ladders, props) */
export const STREET_SKIP = [
  { side: -1 as const, z: 7, r: 3.2 }, { side: 1 as const, z: -15, r: 3.2 }, { side: -1 as const, z: -29, r: 3 },
  { side: 1 as const, z: -49, r: 3 }, { side: -1 as const, z: -62, r: 2.8 }, { side: -1 as const, z: -50, r: 2.2 },
]

/** every window of the alley and the plaza, built once (the wall geometry needs the holes, the window meshes need the instances) */
let _wins: WinInst[] | null = null
export function allWindows(): WinInst[] {
  if (_wins) return _wins
  const all: WinInst[] = []
  SEGS.forEach((s, i) => all.push(...windowsFor(s, 1000 + i * 7, [])))
  for (const side of [-1, 1] as const) {
    const r = rng(side === -1 ? 91 : 92)
    for (let z = PLAZA.z0 - 2; z > PLAZA.z1 + 1; z -= 3.4) for (let k = 0; k < 5; k++) {
      const y = 4.6 + k * 3.4
      if (r() < 0.1) continue
      all.push({ side, x: side * PLAZA.hw, y, z: z + (r() - 0.5) * 0.6, variant: pickWindow(r), w: 0.9 + r() * 0.28, h: 0.92 + r() * 0.3, tone: 0.28 + Math.pow(r(), 1.4) * 1.1 })
    }
  }
  all.push(...plazaArchWindows(pickWindow))
  _wins = all
  return all
}

/** ground-floor roller shutters (3 variants) and doors (3 variants), placed deterministically along each segment */
export interface LevelItem { side: -1 | 1; z: number }
let _level: { shutters: LevelItem[][]; doors: LevelItem[][] } | null = null
export function streetLevelItems(skip = STREET_SKIP) {
  if (_level && skip === STREET_SKIP) return _level
  const r = rng(404)
  const shutters: LevelItem[][] = [[], [], []]
  const doors: LevelItem[][] = [[], [], []]
  for (const s of SEGS) {
    let z = s.z0 - 2.2
    while (z > s.z1 + 2) {
      const blocked = skip.some((k) => k.side === s.side && Math.abs(k.z - z) < k.r)
      const roll = r()
      if (!blocked) {
        if (roll < 0.34) shutters[r.int(0, 2)].push({ side: s.side, z })
        else if (roll < 0.62) doors[r.int(0, 2)].push({ side: s.side, z })
      }
      z -= r.range(3.6, 6.4)
    }
  }
  for (const side of [-1, 1] as const) for (const z of plazaServiceDoors(side)) doors[side === -1 ? 0 : 2].push({ side, z })
  const out = { shutters, doors }
  if (skip === STREET_SKIP) _level = out
  return out
}
