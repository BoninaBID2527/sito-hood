'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { GeoBuilder, tileUV } from '@/lib/geo'
import { rt } from '@/lib/runtime'
import { streetMat } from './materials'
import { wallX } from './layout'
import { DistCull } from './DistCull'

const FLOOR_H = 3.35
const Y0 = 4.4
const W = 2.7 // along the wall
const D = 1.1 // protrusion

/** Local frame: wall surface at x=0, alley is +x, z centred, y from the ground. */
function buildFireEscape(floors: number, detail: number) {
  const solid = new GeoBuilder()
  const grate = new GeoBuilder()
  const rail = 0.02
  const balStep = detail > 0.6 ? 0.2 : 0.38
  for (let k = 0; k < floors; k++) {
    const y = Y0 + k * FLOOR_H
    // platform: grating + frame
    const g = new THREE.PlaneGeometry(W, D)
    tileUV(g, W, D, 0.9)
    grate.add(g, D / 2, y, 0, -Math.PI / 2, 0, 0)
    solid.box(0.07, 0.07, W, D, y - 0.02, 0)
    solid.box(0.07, 0.07, W, 0.04, y - 0.02, 0)
    solid.box(D, 0.07, 0.07, D / 2, y - 0.02, W / 2)
    solid.box(D, 0.07, 0.07, D / 2, y - 0.02, -W / 2)
    // bracket to wall
    solid.box(0.05, 0.05, 0.6, 0.0, y - 0.45, 0, 0, 0, 0)
    solid.box(0.6, 0.04, 0.04, D * 0.45, y - 0.32, W / 2 - 0.2, 0, 0, 0.55)
    solid.box(0.6, 0.04, 0.04, D * 0.45, y - 0.32, -W / 2 + 0.2, 0, 0, 0.55)
    // rails: top + mid on outer edge and ends
    for (const h of [1.0, 0.5]) {
      solid.box(rail * 2, rail * 2, W, D, y + h, 0)
      solid.box(D, rail * 2, rail * 2, D / 2, y + h, W / 2)
      solid.box(D, rail * 2, rail * 2, D / 2, y + h, -W / 2)
    }
    for (let z = -W / 2; z <= W / 2 + 0.001; z += balStep) solid.box(rail, 1.0, rail, D, y + 0.5, z)
    for (let x = balStep; x < D; x += balStep * 1.2) {
      solid.box(rail, 1.0, rail, x, y + 0.5, W / 2)
      solid.box(rail, 1.0, rail, x, y + 0.5, -W / 2)
    }
    // zig-zag stair against the wall up to the next floor
    if (k < floors - 1) {
      const dir = k % 2 === 0 ? 1 : -1
      const z0 = -dir * (W / 2 - 0.25), z1 = dir * (W / 2 - 0.25)
      const L = Math.hypot(z1 - z0, FLOOR_H)
      const ang = Math.atan2(FLOOR_H, z1 - z0)
      const cz = (z0 + z1) / 2, cy = y + FLOOR_H / 2
      const sx = 0.5
      for (const dx of [sx - 0.36, sx + 0.36]) solid.box(0.045, 0.14, L, dx, cy, cz, -ang, 0, 0)
      const steps = 11
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        solid.box(0.78, 0.025, 0.2, sx, y + t * FLOOR_H + 0.02, z0 + (z1 - z0) * t)
      }
      // handrail along the stair
      solid.box(rail * 2, rail * 2, L, sx + 0.38, cy + 0.95, cz, -ang, 0, 0)
    }
  }
  // drop ladder from the first platform
  const ly = Y0
  for (let h = 0.3; h < ly - 1.6; h += 0.3) solid.box(0.02, 0.02, 0.5, D * 0.5, ly - h, -W / 2 + 0.3)
  solid.box(0.03, ly - 1.6, 0.03, D * 0.5, 1.6 + (ly - 1.6) / 2, -W / 2 + 0.06)
  solid.box(0.03, ly - 1.6, 0.03, D * 0.5, 1.6 + (ly - 1.6) / 2, -W / 2 + 0.54)
  return { solid: solid.build(), grate: grate.build() }
}

const PLACEMENTS: { side: -1 | 1; z: number; floors: number }[] = [
  { side: -1, z: -15, floors: 5 },
  { side: -1, z: -33, floors: 4 },
  { side: -1, z: -50, floors: 5 },
  { side: 1, z: 0, floors: 5 },
  { side: 1, z: -18, floors: 4 },
  { side: 1, z: -37, floors: 5 },
  { side: 1, z: -52, floors: 4 },
]

export function FireEscapes() {
  const built = useMemo(() => {
    const detail = rt.quality.fireEscapeDetail
    const variants: Record<number, ReturnType<typeof buildFireEscape>> = {}
    for (const f of new Set(PLACEMENTS.map((p) => p.floors))) variants[f] = buildFireEscape(f, detail)
    const metal = streetMat({ color: '#1d1d20', roughness: 0.5, metalness: 0.65, aoBase: 0.6 })
    const grating = streetMat({ color: '#25252a', roughness: 0.6, metalness: 0.6, alphaMap: A.grating, alphaTest: 0.5, side: THREE.DoubleSide, aoBase: 0.6 })
    return { variants, metal, grating }
  }, [])

  useEffect(
    () => () => {
      Object.values(built.variants).forEach((v) => {
        v.solid.dispose()
        v.grate.dispose()
      })
      built.metal.dispose()
      built.grating.dispose()
    },
    [built],
  )

  return (
    <group>
      {PLACEMENTS.map((p, i) => {
        const v = built.variants[p.floors]
        return (
          <DistCull key={i} at={[wallX(p.side, p.z), 6, p.z]} r={62}>
            <group position={[wallX(p.side, p.z), 0, p.z]} rotation={[0, p.side === -1 ? 0 : Math.PI, 0]}>
              <mesh geometry={v.solid} material={built.metal} castShadow receiveShadow />
              <mesh geometry={v.grate} material={built.grating} />
            </group>
          </DistCull>
        )
      })}
    </group>
  )
}

export const FIRE_ESCAPES = PLACEMENTS
export { FLOOR_H, Y0 }
