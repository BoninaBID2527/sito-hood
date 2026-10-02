'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { GeoBuilder } from '@/lib/geo'
import { rng } from '@/lib/math'
import { palette } from '@/lib/timeOfDay'
import { garmentTexture, awningTexture } from '@/lib/textures'
import { streetMat } from './materials'
import { wallX } from './layout'

/**
 * Authored foreground layer — things the camera passes CLOSE to (scooter, blade signs, awnings, laundry lines, bags).
 * They are placed against the camera spline so that each one crosses a frame edge as the shot moves: this is what
 * turns a straight tunnel into layered foreground / midground / background.
 */
export function Foreground() {
  const kit = useMemo(() => {
    const r = rng(404)
    // ── scooter (parked left, start of the alley)
    const body = new GeoBuilder(), chrome = new GeoBuilder(), seat = new GeoBuilder(), tyre = new GeoBuilder(), lamp = new GeoBuilder()
    {
      tyre.cyl(0.21, 0.21, 0.13, 0, 0.21, -0.58, 18, 0, 0, Math.PI / 2)
      tyre.cyl(0.19, 0.19, 0.12, 0, 0.19, 0.64, 18, 0, 0, Math.PI / 2)
      chrome.cyl(0.09, 0.09, 0.15, 0, 0.21, -0.58, 12, 0, 0, Math.PI / 2)
      chrome.cyl(0.08, 0.08, 0.14, 0, 0.19, 0.64, 12, 0, 0, Math.PI / 2)
      body.box(0.44, 0.4, 0.66, 0, 0.5, -0.5)
      body.box(0.4, 0.07, 0.56, 0, 0.27, 0.02)
      body.box(0.42, 0.66, 0.07, 0, 0.62, 0.34, -0.28)
      body.box(0.16, 0.06, 0.38, 0, 0.45, 0.66)
      body.box(0.33, 0.16, 0.2, 0, 0.98, 0.46)
      body.box(0.2, 0.16, 0.3, 0.0, 0.34, -0.12)
      chrome.cyl(0.018, 0.018, 0.56, 0, 0.42, 0.62, 6, 0.22)
      chrome.cyl(0.016, 0.016, 0.74, 0, 1.0, 0.44, 6, 0, 0, Math.PI / 2)
      chrome.cyl(0.01, 0.01, 0.2, 0.32, 1.1, 0.4, 5, 0, 0, 0.3)
      chrome.cyl(0.01, 0.01, 0.2, -0.32, 1.1, 0.4, 5, 0, 0, -0.3)
      seat.box(0.34, 0.1, 0.56, 0, 0.78, -0.42)
      seat.box(0.3, 0.16, 0.12, 0, 0.74, -0.7)
      tyre.cyl(0.05, 0.05, 0.12, 0.2, 0.3, -0.84, 8, Math.PI / 2)
      lamp.add(new THREE.SphereGeometry(0.07, 10, 8), 0, 1.0, 0.57)
    }
    const mkb = (b: GeoBuilder, p: THREE.MeshStandardMaterialParameters) => ({ geo: b.build(), mat: streetMat({ aoBase: 0.55, ...p }) })
    const scooter = [
      mkb(body, { color: '#5c9a98', roughness: 0.38, metalness: 0.35 }),
      mkb(chrome, { color: '#b9bcc0', roughness: 0.25, metalness: 0.9 }),
      mkb(seat, { color: '#251d1a', roughness: 0.7 }),
      mkb(tyre, { color: '#151517', roughness: 0.85 }),
    ]
    const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe9c0', emissive: '#ffe0a0', emissiveIntensity: 0.4, roughness: 0.3 })
    const lampGeo = lamp.build()

    // ── blade signs, awnings
    const plane = new THREE.PlaneGeometry(1, 1)
    const signMat = (tex: THREE.Texture) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.1 })
    const sMats = [signMat(A.signs.osteria), signMat(A.signs.farmacia)]
    const bracket = new GeoBuilder()
    bracket.box(1.4, 0.05, 0.05, 0, 0.55, 0)
    bracket.box(0.04, 0.5, 0.04, -0.68, 0.3, 0)
    bracket.box(0.05, 0.05, 1.3, -0.68, 0.02, 0)
    const bracketGeo = bracket.build()
    const bracketMat = streetMat({ color: '#18181a', roughness: 0.5, metalness: 0.7, aoBase: 0.7 })

    const awnTex = [awningTexture('#a3322a', '#e6d9bd', 6), awningTexture('#2f5a44', '#dccfae', 8)]
    const awnMats = awnTex.map((t) => streetMat({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95, aoBase: 0.7, macro: 0.5 }))
    const awnGeo = new THREE.PlaneGeometry(1, 1)
    awnGeo.translate(0, -0.5, 0)

    // ── laundry lines
    const garments = (['tee', 'trousers', 'towel', 'hoodie'] as const).flatMap((k, i) => [
      { k, tex: garmentTexture(k, ['#6c7d86', '#7d6b5a', '#9a8a74', '#53606c'][i], 30 + i) },
      { k, tex: garmentTexture(k, ['#a9a29a', '#4d5a4a', '#8a5a4d', '#3f4a5e'][i], 40 + i) },
    ])
    const clothGeo = new THREE.PlaneGeometry(1, 1, 1, 5)
    const clothMats = garments.map((g) => { const m = streetMat({ map: g.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.96, aoBase: 0.95, flutter: 0.1, macro: 0.15 }); m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = g.tex; m.emissiveIntensity = 0.28; return m })
    const ropeMat = new THREE.MeshBasicMaterial({ color: '#15130f' })
    const ropes: THREE.BufferGeometry[] = []
    const cloth: { m: number; pos: [number, number, number]; rot: number; s: [number, number] }[] = []
    const lines: [number, number, number, number][] = [
      // z, yLeft, yRight, sag
      [10.5, 4.55, 4.25, 0.35], [-12.5, 4.35, 4.6, 0.4], [-33.5, 4.6, 4.3, 0.34],
    ]
    for (const [z, yl, yr, sag] of lines) {
      const xl = wallX(-1, z) + 0.08, xr = wallX(1, z) - 0.08
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(xl + (xr - xl) * t, yl + (yr - yl) * t - Math.sin(t * Math.PI) * sag, z)) }
      ropes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.012, 4, false))
      const n = 4 + r.int(0, 2)
      for (let i = 0; i < n; i++) {
        const t = 0.14 + (i + r() * 0.5) / (n + 0.3) * 0.74
        const y = yl + (yr - yl) * t - Math.sin(t * Math.PI) * sag
        const w = r.range(0.42, 0.62)
        cloth.push({ m: r.int(0, clothMats.length - 1), pos: [xl + (xr - xl) * t, y - 0.3 * w * 1.35, z + r.range(-0.05, 0.05)], rot: r.range(-0.2, 0.2), s: [w, w * 1.45] })
      }
    }
    const ropeGeo = ropes.length ? (new GeoBuilder()) : null
    ropes.forEach((g) => ropeGeo!.add(g))
    const ropesMerged = ropeGeo!.build()

    // ── trash bags (lumpy spheres)
    const bagGeo = new THREE.IcosahedronGeometry(0.28, 1)
    const bp = bagGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < bp.count; i++) {
      const k = 1 + (Math.sin(bp.getX(i) * 11 + bp.getY(i) * 7) * 0.07) + (Math.sin(bp.getZ(i) * 9) * 0.06)
      bp.setXYZ(i, bp.getX(i) * k * 1.05, bp.getY(i) * k * 0.82, bp.getZ(i) * k)
    }
    bagGeo.computeVertexNormals()
    const bagMat = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.28, metalness: 0.1 })
    const bags: [number, number, number, number][] = [
      [-1, 5.2, 0.62, 1.0], [-1, 4.7, 0.9, 0.82], [-1, 5.7, 0.8, 0.9], [1, 2.2, 0.7, 1.05], [1, 1.5, 1.0, 0.8],
      [1, -17.6, 0.8, 1.0], [-1, -36, 0.8, 0.9],
    ]
    return { scooter, lampMat, lampGeo, plane, sMats, bracketGeo, bracketMat, awnTex, awnMats, awnGeo, garments, clothGeo, clothMats, cloth, ropeMat, ropesMerged, bagGeo, bagMat, bags }
  }, [])

  useFrame(() => {
    const k = 0.1 + palette.lamps * 0.5
    kit.sMats.forEach((m) => (m.emissiveIntensity = k))
    kit.lampMat.emissiveIntensity = 0.3 + palette.lamps * 1.3
  })

  useEffect(
    () => () => {
      kit.scooter.forEach((p) => { p.geo.dispose(); p.mat.dispose() })
      kit.lampMat.dispose(); kit.lampGeo.dispose(); kit.plane.dispose(); kit.sMats.forEach((m) => m.dispose())
      kit.bracketGeo.dispose(); kit.bracketMat.dispose(); kit.awnTex.forEach((t) => t.dispose()); kit.awnMats.forEach((m) => m.dispose()); kit.awnGeo.dispose()
      kit.garments.forEach((g) => g.tex.dispose()); kit.clothGeo.dispose(); kit.clothMats.forEach((m) => m.dispose())
      kit.ropeMat.dispose(); kit.ropesMerged.dispose(); kit.bagGeo.dispose(); kit.bagMat.dispose()
    },
    [kit],
  )

  const scX = wallX(-1, 12.4) + 1.45
  const sx = (side: -1 | 1, z: number) => wallX(side, z)
  return (
    <group>
      {/* scooter */}
      <group position={[scX, 0, 12.4]} rotation={[0, 0.2, -0.04]}>
        {kit.scooter.map((p, i) => <mesh key={i} geometry={p.geo} material={p.mat} />)}
        <mesh geometry={kit.lampGeo} material={kit.lampMat} />
      </group>
      {/* blade signs on brackets */}
      <group position={[sx(-1, -5.2) + 0.7, 3.15, -5.2]}>
        <mesh geometry={kit.bracketGeo} material={kit.bracketMat} rotation={[0, Math.PI / 2, 0]} position={[0.0, 0.1, 0]} />
        <mesh geometry={kit.plane} material={kit.sMats[0]} scale={[1.05, 0.78, 1]} position={[0.62, -0.2, 0]} />
      </group>
      <group position={[sx(1, -20.5) - 0.7, 4.1, -20.5]}>
        <mesh geometry={kit.bracketGeo} material={kit.bracketMat} rotation={[0, -Math.PI / 2, 0]} position={[0.0, 0.1, 0]} />
        <mesh geometry={kit.plane} material={kit.sMats[1]} scale={[0.9, 0.67, 1]} position={[-0.58, -0.2, 0]} />
      </group>
      {/* shop awnings (camera slips past them) */}
      <group position={[sx(-1, -14.5) + 0.04, 3.55, -14.5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={kit.awnGeo} material={kit.awnMats[0]} rotation={[-1.05, 0, 0]} scale={[2.6, 1.55, 1]} />
      </group>
      <group position={[sx(1, 6.8) - 0.04, 3.7, 6.8]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={kit.awnGeo} material={kit.awnMats[1]} rotation={[-1.05, 0, 0]} scale={[2.8, 1.55, 1]} />
      </group>
      {/* laundry */}
      <mesh geometry={kit.ropesMerged} material={kit.ropeMat} />
      {kit.cloth.map((c, i) => (
        <mesh key={i} geometry={kit.clothGeo} material={kit.clothMats[c.m]} position={c.pos} rotation={[0, c.rot, 0]} scale={[c.s[0], c.s[1], 1]} />
      ))}
      {/* bags */}
      {kit.bags.map(([side, z, off, s], i) => (
        <mesh key={i} geometry={kit.bagGeo} material={kit.bagMat} position={[sx(side as -1 | 1, z) - side * off, 0.2 * s, z]} scale={s} rotation={[0, i * 1.7, 0]} />
      ))}
    </group>
  )
}
