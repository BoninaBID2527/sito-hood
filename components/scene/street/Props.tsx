'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { GeoBuilder } from '@/lib/geo'
import { rng } from '@/lib/math'
import { streetMat } from './materials'
import { SEGS, wallX } from './layout'

/** Pipes, ACs, dumpsters, bins, crates, bike, hydrant, bollards — merged per material (a handful of draw calls). */
export function Props() {
  const built = useMemo(() => {
    const r = rng(2024)
    const pipes = new GeoBuilder()
    const metal = new GeoBuilder()
    const green = new GeoBuilder()
    const blue = new GeoBuilder()
    const wood = new GeoBuilder()
    const galv = new GeoBuilder()
    const rust = new GeoBuilder()
    const ac = new GeoBuilder()
    const rubber = new GeoBuilder()

    // ── pipes: vertical drains at segment breaks + horizontal gas lines
    for (const s of SEGS) {
      const inw = -s.side
      const x = s.side * s.hw + inw * 0.11
      const zc = s.z0 - 0.7
      pipes.cyl(0.075, 0.075, s.h - 1, x, (s.h - 1) / 2 + 0.2, zc, 10)
      for (let y = 1.2; y < s.h - 1; y += 3.6) pipes.box(0.2, 0.06, 0.2, x - inw * 0.03, y, zc)
      // horizontal run
      const len = (s.z0 - s.z1) - 3
      pipes.cyl(0.05, 0.05, len, s.side * s.hw + inw * 0.09, 2.7 + r() * 0.5, (s.z0 + s.z1) / 2, 8, Math.PI / 2, 0, 0)
      // second thin conduit
      pipes.cyl(0.03, 0.03, len * 0.8, s.side * s.hw + inw * 0.07, 3.35, (s.z0 + s.z1) / 2 - 1, 6, Math.PI / 2, 0, 0)
      // drain elbows reaching the ground
      pipes.box(0.14, 0.4, 0.14, x, 0.2, zc)
    }

    // ── AC units on the facade
    const acPlaces: [-1 | 1, number, number][] = [[-1, 8, 8.7], [-1, -2, 12], [-1, -28, 8.7], [-1, -40, 12], [1, 6, 12], [1, -14, 8.7], [1, -33, 12], [1, -48, 8.7], [1, -22, 15.3], [-1, -18, 15.3]]
    for (const [side, z, y] of acPlaces) {
      const x = wallX(side, z) - side * 0.35
      ac.box(0.55, 0.62, 0.95, x, y - 0.7, z)
      pipes.box(0.2, 0.05, 0.05, x + side * 0.3, y - 0.45, z - 0.3)
    }

    // ── dumpsters / bins / crates (kept clear of the camera lane x∈[-0.9, 0.9])
    const dumpsters: [number, number, number][] = [[-1, -9, 0.4], [1, -31, -0.3], [-1, -45, 0.2], [1, 9, 0.1], [-1, -57, 0]]
    for (const [side, z, rot] of dumpsters) {
      const x = wallX(side as -1 | 1, z) - side * 0.95
      const b = (z % 2 ? green : blue)
      const g = new THREE.BoxGeometry(0.95, 1.1, 1.8)
      g.rotateY(rot * 0.3)
      b.add(g, x, 0.7, z)
      const lid = new THREE.BoxGeometry(1.0, 0.07, 1.85)
      lid.rotateY(rot * 0.3)
      rubber.add(lid, x, 1.3, z)
      metal.cyl(0.05, 0.05, 0.95, x - side * 0.5, 0.1, z - 0.6, 6, 0, 0, Math.PI / 2)
    }
    const bins: [number, number][] = [[-1, -3], [1, -19], [-1, -22], [1, -41], [-1, -53], [1, -62], [-1, 4]]
    for (const [side, z] of bins) {
      const x = wallX(side as -1 | 1, z) - side * (0.62 + r() * 0.15)
      galv.cyl(0.28, 0.25, 0.75, x, 0.5, z, 14)
      galv.cyl(0.3, 0.3, 0.06, x, 0.9, z, 14)
      galv.cyl(0.04, 0.04, 0.1, x, 0.97, z, 6)
    }
    // crates + pallets
    const crates: [number, number][] = [[1, -8], [-1, -27], [1, -56], [-1, 12]]
    for (const [side, z] of crates) {
      const x = wallX(side as -1 | 1, z) - side * 0.75
      for (let i = 0; i < 3; i++) {
        const w = 0.5 + r() * 0.2
        const g = new THREE.BoxGeometry(w, 0.4, w)
        g.rotateY(r() * 1.2)
        wood.add(g, x - side * r() * 0.3, 0.37 + (i === 2 ? 0.4 : 0), z + (i - 1) * 0.5)
      }
      wood.box(1.1, 0.12, 0.9, x, 0.22, z + 0.2)
    }

    // ── hydrant + bollards (plaza)
    const hydrant = (x: number, z: number) => {
      rust.cyl(0.13, 0.15, 0.62, x, 0.46, z, 10)
      rust.cyl(0.16, 0.16, 0.06, x, 0.78, z, 10)
      rust.cyl(0.1, 0.1, 0.12, x, 0.84, z, 8)
      rust.cyl(0.06, 0.06, 0.4, x, 0.5, z, 8, 0, 0, Math.PI / 2)
    }
    hydrant(2.2, -13)
    hydrant(-7.5, -88)
    for (let i = 0; i < 7; i++) metal.cyl(0.09, 0.09, 0.9, -5 + i * 1.6, 0.45, -76.6, 8)
    // plaza clutter near the walls
    const plazaDump = (x: number, z: number, rot: number, b: GeoBuilder) => {
      const g = new THREE.BoxGeometry(2.4, 1.3, 1.2)
      g.rotateY(rot)
      b.add(g, x, 0.75, z)
      const lid = new THREE.BoxGeometry(2.5, 0.08, 1.3)
      lid.rotateY(rot)
      rubber.add(lid, x, 1.43, z)
    }
    plazaDump(-10.2, -80, 0.1, green)
    plazaDump(-10.4, -83, -0.15, blue)
    plazaDump(10.1, -97.5, 0.2, green)
    plazaDump(10.5, -100.4, -0.1, blue)
    for (let i = 0; i < 3; i++) galv.cyl(0.3, 0.27, 0.8, 10.4 + i * 0.1, 0.5, -91 - i * 0.7, 14)

    // ── bicycle leaning on the right wall
    {
      const bx = wallX(1, -25) - 0.5, bz = -24.5
      const wheel = new THREE.TorusGeometry(0.34, 0.018, 6, 24)
      wheel.rotateY(Math.PI / 2)
      metal.add(wheel.clone(), bx, 0.38, bz - 0.55, 0, 0, 0.08)
      metal.add(wheel, bx, 0.38, bz + 0.55, 0, 0, 0.08)
      metal.cyl(0.015, 0.015, 1.2, bx, 0.5, bz, 5, Math.PI / 2, 0, 0)
      metal.cyl(0.015, 0.015, 0.9, bx, 0.62, bz + 0.15, 5, 0.9, 0, 0)
      metal.cyl(0.015, 0.015, 0.4, bx, 0.9, bz - 0.5, 5, 0, 0, 0)
      metal.box(0.5, 0.02, 0.02, bx, 1.02, bz - 0.52)
      metal.box(0.1, 0.03, 0.22, bx, 0.98, bz + 0.38)
    }

    const mk = (b: GeoBuilder, params: THREE.MeshStandardMaterialParameters) => (b.empty ? null : { geo: b.build(), mat: streetMat({ aoBase: 0.55, ...params }) })
    const parts = [
      mk(pipes, { color: '#5a5650', roughness: 0.65, metalness: 0.5 }),
      mk(metal, { color: '#26262a', roughness: 0.55, metalness: 0.7 }),
      mk(green, { color: '#2f5a40', roughness: 0.6, metalness: 0.2 }),
      mk(blue, { color: '#2a3e66', roughness: 0.6, metalness: 0.2 }),
      mk(wood, { color: '#8a6a46', roughness: 0.9 }),
      mk(galv, { color: '#8c9296', roughness: 0.45, metalness: 0.7 }),
      mk(rust, { color: '#9a3a2a', roughness: 0.55, metalness: 0.4 }),
      mk(ac, { color: '#a9aaa4', roughness: 0.6, metalness: 0.3 }),
      mk(rubber, { color: '#18181a', roughness: 0.8 }),
    ].filter(Boolean) as { geo: THREE.BufferGeometry; mat: THREE.Material }[]

    // fan faces for the AC units
    const fanGeo = new THREE.PlaneGeometry(0.52, 0.52)
    const fanMat = new THREE.MeshStandardMaterial({ map: A.fan, roughness: 0.6, metalness: 0.4 })
    const fans: { pos: [number, number, number]; rot: number }[] = acPlaces.map(([side, z, y]) => ({
      pos: [wallX(side, z) - side * 0.63, y - 0.7, z],
      rot: side === -1 ? Math.PI / 2 : -Math.PI / 2,
    }))
    return { parts, fanGeo, fanMat, fans }
  }, [])

  useEffect(
    () => () => {
      built.parts.forEach((p) => {
        p.geo.dispose()
        p.mat.dispose()
      })
      built.fanGeo.dispose()
      built.fanMat.dispose()
    },
    [built],
  )

  return (
    <group>
      {built.parts.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} />
      ))}
      {built.fans.map((f, i) => (
        <mesh key={i} geometry={built.fanGeo} material={built.fanMat} position={f.pos} rotation={[0, f.rot, 0]} />
      ))}
    </group>
  )
}

