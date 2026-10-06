import { rng } from '@/lib/math'
import type { WinInst } from './layout'

/**
 * V3.7 — the plaza is a 360° place. Beyond its far end (z = −118) the world used to stop at a ground edge and a gap of sky; the camera that
 * circles the installation looks straight at it. The far end is now built: two rear blocks of different height, a narrow service passage
 * between them (so the view goes THROUGH the plaza into a second layer), a footbridge across the passage, and an end façade with its own lamp.
 *
 *   NEAR   plaza floor, loading dock, bollards                               (hero: real geometry, real openings)
 *   MID    the two rear façades + the passage walls                         (openings, piers, cornice, plant, fire escape)
 *   FAR    the end façade of the passage, then the existing skyline blocks  (z ≤ −140) and the 2.5-D city layers
 */
export const PA = {
  zFace: -118,
  passHW: 3.6,
  endZ: -150,
  /** rear-left: lower, brick, industrial (loading dock); rear-right: taller, residential, set-back top floors, fire escape */
  RL: { x0: -14, x1: -3.6, h: 17.5 },
  RR: { x0: 3.6, x1: 14, h: 19.5, topH: 25.5, topX0: 3.6, topZ: -120.4 },
  END: { x0: -4.0, x1: 4.0, h: 23 },
  dockY: 1.15,
  dockDepth: 2.4,
  /** bridge across the passage */
  bridge: { z: -128, y: 8.4, w: 1.9, h: 2.5 },
} as const


/** the windows of every new façade (instanced by the shared window system; `face: 'z'` windows look toward +z) */
export function plazaArchWindows(pick: (r: () => number) => WinInst['variant']): WinInst[] {
  const out: WinInst[] = []
  const r = rng(7707)
  const tone = () => 0.28 + Math.pow(r(), 1.4) * 1.1
  // ── rear-left (industrial): big steel windows, three floors above the dock level
  for (const x of [-11.2, -8.2, -5.2]) for (const y of [6.2, 9.6, 13.0]) {
    if (r() < 0.12) continue
    let v = pick(r); if (v === 'tv' || v === 'ac') v = 'dark'
    out.push({ side: 1, face: 'z', x, y, z: PA.zFace, variant: v, w: 1.7 + r() * 0.2, h: 1.05 + r() * 0.12, tone: tone() })
  }
  // ── rear-right (residential): the ordinary window grid, five floors + two under the set-back
  for (const x of [5.2, 8.2, 11.2]) for (let k = 0; k < 5; k++) {
    if (r() < 0.08) continue
    const y = 5.1 + k * 3.35
    out.push({ side: 1, face: 'z', x, y, z: PA.zFace, variant: pick(r), w: 0.9 + r() * 0.28, h: 0.92 + r() * 0.3, tone: tone() })
  }
  for (const x of [8.0, 11.0]) for (const y of [21.4, 24.0]) {
    if (r() < 0.1) continue
    out.push({ side: 1, face: 'z', x, y, z: PA.RR.topZ, variant: pick(r), w: 0.95 + r() * 0.2, h: 0.95 + r() * 0.2, tone: tone() })
  }
  // ── the passage walls (they face each other across 7.2 m): a few windows, mostly dead
  for (const side of [-1, 1] as const) {
    const rr = rng(side === -1 ? 7711 : 7712)
    for (let z = PA.zFace - 3.2; z > PA.endZ + 2; z -= 3.4) for (let k = 0; k < 4; k++) {
      const y = 4.7 + k * 3.4
      if (y > (side === -1 ? PA.RL.h : PA.RR.h) - 2) break
      if (rr() < 0.22) continue
      if (Math.abs(z - PA.bridge.z) < 1.8 && y > 6 && y < 11.5) continue // the bridge passes there
      let v = pick(rr); if (v === 'tv') v = 'blind'
      out.push({ side, x: side * PA.passHW, y, z: z + (rr() - 0.5) * 0.5, variant: v, w: 0.88 + rr() * 0.26, h: 0.92 + rr() * 0.3, tone: 0.28 + Math.pow(rr(), 1.4) * 1.0 })
    }
  }
  // ── the end façade (what you see through the passage): lit windows catch the eye and give the depth a destination
  for (const x of [-2.4, 0, 2.4]) for (let k = 0; k < 5; k++) {
    const y = 4.4 + k * 3.5
    if (r() < 0.08) continue
    const v = k === 2 && x === 0 ? 'warm2' : pick(r)
    out.push({ side: 1, face: 'z', x, y, z: PA.endZ, variant: v, w: 0.95 + r() * 0.2, h: 0.95 + r() * 0.2, tone: tone() })
  }
  return out
}
