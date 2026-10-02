import { rng } from '@/lib/math'

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
  variant: 'dark' | 'warm' | 'cool' | 'blind'
  w: number
  h: number
}

export function windowsFor(seg: Seg, seed: number, skipZ: number[] = []): WinInst[] {
  const r = rng(seed)
  const out: WinInst[] = []
  const pitch = 3.0
  for (let z = seg.z0 - 1.4; z > seg.z1 + 1.0; z -= pitch) {
    if (skipZ.some((s) => Math.abs(s - z) < 1.8)) continue
    for (let k = 0; k < 6; k++) {
      const y = 5.3 + k * 3.35
      if (y > seg.h - 2) break
      if (r() < 0.07) continue
      const roll = r()
      const lit = 0.2 + 0.0
      const variant: WinInst['variant'] = roll < lit ? 'warm' : roll < lit + 0.07 ? 'cool' : roll < lit + 0.4 ? 'blind' : 'dark'
      out.push({ side: seg.side, x: seg.side * seg.hw, y, z, variant, w: 1.0, h: 1.55 })
    }
  }
  return out
}
