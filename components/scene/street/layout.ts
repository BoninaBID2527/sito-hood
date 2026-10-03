import { rng } from '@/lib/math'
import type { WindowVariant } from '@/lib/textures'

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
