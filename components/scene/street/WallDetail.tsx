'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { GeoBuilder } from '@/lib/geo'
import { rng } from '@/lib/math'
import { rt } from '@/lib/runtime'
import { palette } from '@/lib/timeOfDay'
import { streetMat } from './materials'
import { SEGS, wallX } from './layout'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)

/**
 * Authored wall furniture: meter boxes with conduit, wall lamps with light spill, CCTV, vents, satellite dishes,
 * cable swags and neon. These break the long brick planes into readable "places" and give the camera something to pass.
 */
export function WallDetail() {
  const kit = useMemo(() => {
    const r = rng(8080)
    const metal = new GeoBuilder(), grey = new GeoBuilder(), cageB = new GeoBuilder(), dish = new GeoBuilder()
    const cables: THREE.BufferGeometry[] = []
    const lamps: { side: -1 | 1; z: number; y: number }[] = []
    const cctv: { side: -1 | 1; z: number; y: number }[] = []

    for (const s of SEGS) {
      const side = s.side
      const inw = -side
      const wx = (z: number) => wallX(side, z)
      const len = s.z0 - s.z1
      // meter / fuse boxes with conduit up the wall
      const nMeter = r.int(1, 2)
      for (let i = 0; i < nMeter; i++) {
        const z = s.z0 - 1.5 - r() * (len - 3)
        const x = wx(z) + inw * 0.09
        const y = 1.35 + r() * 0.5
        grey.box(0.18, 0.62, 0.5, x, y, z)
        grey.box(0.19, 0.5, 0.02, x + inw * 0.005, y, z - 0.26)
        metal.cyl(0.028, 0.028, 3.2 - y, x + inw * 0.02, y + (3.2 - y) / 2 + 0.3, z + 0.12, 6)
        metal.cyl(0.028, 0.028, y - 0.2, x + inw * 0.02, (y - 0.3) / 2, z - 0.12, 6)
      }
      // vent grilles + extractor
      for (let i = 0; i < 2; i++) {
        const z = s.z0 - 1 - r() * (len - 2)
        const x = wx(z) + inw * 0.06
        const y = 2.1 + r() * 1.4
        metal.box(0.1, 0.34, 0.74, x, y, z)
        grey.box(0.12, 0.28, 0.68, x + inw * 0.02, y, z)
        if (r() < 0.5) metal.cyl(0.17, 0.17, 0.3, x + inw * 0.16, y + 0.75, z, 12, 0, 0, Math.PI / 2)
      }
      // wall lamps
      const nLamp = r.int(1, 2)
      for (let i = 0; i < nLamp; i++) {
        const z = s.z0 - 2 - r() * (len - 4)
        const y = 3.1 + r() * 0.5
        const x = wx(z)
        metal.box(0.28, 0.06, 0.06, x + inw * 0.14, y + 0.12, z)
        cageB.cyl(0.08, 0.1, 0.22, x + inw * 0.3, y, z, 8)
        lamps.push({ side, z, y })
      }
      // cctv
      if (r() < 0.55) {
        const z = s.z0 - 3 - r() * (len - 6)
        const y = 4.0 + r() * 0.8
        const x = wx(z)
        metal.box(0.5, 0.04, 0.04, x + inw * 0.25, y + 0.14, z)
        grey.box(0.32, 0.12, 0.12, x + inw * 0.52, y, z, 0, 0, 0)
        cctv.push({ side, z, y })
      }
      // satellite dishes up high
      for (let i = 0; i < 2; i++) {
        const z = s.z0 - 1.5 - r() * (len - 3)
        const y = 9 + r() * 6
        if (y > s.h - 1.5) continue
        const x = wx(z) + inw * 0.45
        const d = new THREE.SphereGeometry(0.42, 14, 6, 0, Math.PI * 2, 0, 0.95)
        d.rotateZ(inw > 0 ? -Math.PI / 2 : Math.PI / 2)
        dish.add(d, x, y, z)
        dish.cyl(0.015, 0.015, 0.5, x + inw * 0.2, y, z, 5, 0, 0, Math.PI / 2)
        grey.cyl(0.02, 0.02, 0.45, x - inw * 0.2, y - 0.1, z, 5, 0, 0, Math.PI / 2)
      }
      // cable swags along the facade
      for (let i = 0; i < 3; i++) {
        const z0 = s.z0 - 0.6 - r() * (len - 4)
        const z1 = z0 - r.range(2.5, 7)
        const y0 = 5.2 + r() * 5, y1 = y0 + r.range(-0.8, 0.5)
        const pts: THREE.Vector3[] = []
        for (let k = 0; k <= 10; k++) {
          const t = k / 10
          const z = z0 + (z1 - z0) * t
          pts.push(new THREE.Vector3(wx(z) + inw * (0.09 + Math.sin(t * Math.PI) * 0.06), y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 0.35, z))
        }
        cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.016, 4, false))
      }
    }
    const mk = (b: GeoBuilder, p: THREE.MeshStandardMaterialParameters) => ({ geo: b.build(), mat: streetMat({ aoBase: 0.6, ...p }) })
    const parts = [
      mk(metal, { color: '#1c1c1f', roughness: 0.5, metalness: 0.7 }),
      mk(grey, { color: '#8d908c', roughness: 0.6, metalness: 0.3 }),
      mk(cageB, { color: '#1b1b1d', roughness: 0.4, metalness: 0.7 }),
      mk(dish, { color: '#bfc1bc', roughness: 0.5, metalness: 0.4 }),
    ]
    const cableGeo = cables.length ? (() => { const b = new GeoBuilder(); cables.forEach((g) => b.add(g)); return b.build() })() : null
    const cableMat = new THREE.MeshBasicMaterial({ color: '#0a0a0b' })

    // lamp bulbs + light spill on the wall (additive), CCTV LEDs
    const bulbGeo = new THREE.SphereGeometry(0.07, 8, 6)
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.8) })
    const spillMat = new THREE.MeshBasicMaterial({ map: A.glow, color: new THREE.Color('#ffb868'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0, fog: false })
    const spillGeo = new THREE.PlaneGeometry(1, 1)
    const ledGeo = new THREE.SphereGeometry(0.018, 6, 4)
    const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.2, 0.1) })

    // neon
    const neonGeo = new THREE.PlaneGeometry(1, 1)
    const neonMat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })
    const neons = [
      { m: neonMat(A.signs.neonPizza), side: 1 as const, z: -26.6, y: 3.7, w: 1.25, h: 0.47 },
      { m: neonMat(A.signs.neonOpen), side: -1 as const, z: -44.4, y: 3.5, w: 0.96, h: 0.4 },
      { m: neonMat(A.signs.neonNotte), side: -1 as const, z: -6.2, y: 3.3, w: 1.3, h: 0.5 },
    ]
    return { parts, cableGeo, cableMat, bulbGeo, bulbMat, spillMat, spillGeo, ledGeo, ledMat, lamps, cctv, neonGeo, neons }
  }, [])

  const led = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const k = 0.15 + palette.lamps * 0.85
    kit.spillMat.opacity = 0.2 * k
    kit.bulbMat.color.setRGB(4 * k + 0.6, 3 * k + 0.45, 1.8 * k + 0.3)
    kit.ledMat.color.setRGB(rt.time % 2.4 < 0.18 ? 6 : 0.4, 0.1, 0.05)
    const flick = 0.92 + 0.08 * Math.sin(rt.time * 31) * Math.sin(rt.time * 5.3)
    kit.neons.forEach((n, i) => { (n.m as THREE.MeshBasicMaterial).color.setScalar((0.5 + palette.lamps * 0.9) * (i === 1 ? flick : 1)) })
  })
  void led

  useEffect(
    () => () => {
      kit.parts.forEach((p) => { p.geo.dispose(); p.mat.dispose() })
      kit.cableGeo?.dispose(); kit.cableMat.dispose(); kit.bulbGeo.dispose(); kit.bulbMat.dispose(); kit.spillMat.dispose(); kit.spillGeo.dispose()
      kit.ledGeo.dispose(); kit.ledMat.dispose(); kit.neonGeo.dispose(); kit.neons.forEach((n) => n.m.dispose())
    },
    [kit],
  )

  return (
    <group>
      {kit.parts.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} />)}
      {kit.cableGeo && <mesh geometry={kit.cableGeo} material={kit.cableMat} />}
      {kit.lamps.map((l, i) => {
        const x = wallX(l.side, l.z) - l.side * 0.3
        return (
          <group key={'l' + i}>
            <mesh geometry={kit.bulbGeo} material={kit.bulbMat} position={[x, l.y, l.z]} />
            <mesh geometry={kit.spillGeo} material={kit.spillMat} position={[wallX(l.side, l.z) - l.side * 0.05, l.y - 0.4, l.z]} rotation={[0, rotFor(l.side), 0]} scale={[4.2, 3.6, 1]} renderOrder={3} />
          </group>
        )
      })}
      {kit.cctv.map((c, i) => <mesh key={'c' + i} geometry={kit.ledGeo} material={kit.ledMat} position={[wallX(c.side, c.z) - c.side * 0.6, c.y - 0.05, c.z]} />)}
      {kit.neons.map((n, i) => (
        <mesh key={'n' + i} geometry={kit.neonGeo} material={n.m} position={[wallX(n.side, n.z) - n.side * 0.08, n.y, n.z]} rotation={[0, rotFor(n.side), 0]} scale={[n.w, n.h, 1]} />
      ))}
    </group>
  )
}
