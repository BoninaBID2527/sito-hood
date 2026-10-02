'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { palette } from '@/lib/timeOfDay'
import { streetMat } from './materials'
import { worldUV } from '@/lib/geo'

/** Distant skyline layers (2.5D) + a few big blocks so the plaza reads as part of a city. */
export function Backdrop({ origin = [0, 0, 0] as [number, number, number], z = [-240, -330, -430], blocks: withBlocks = true }) {
  const kit = useMemo(() => {
    const layers = A.skyline.map((l, i) => {
      const w = [520, 640, 760][i]
      const geo = new THREE.PlaneGeometry(w, w / 4)
      const sil = new THREE.MeshBasicMaterial({ map: l.silhouette, transparent: true, fog: false, depthWrite: false, color: new THREE.Color('#444') })
      const lit = new THREE.MeshBasicMaterial({ map: l.lights, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0 })
      return { geo, sil, lit, w }
    })
    // big blocks flanking the far end of the plaza
    const blocks: { p: [number, number, number]; s: [number, number, number] }[] = [
      { p: [-34, 19, -140], s: [30, 38, 26] },
      { p: [-28, 26, -176], s: [28, 52, 24] },
      { p: [36, 22, -146], s: [32, 44, 26] },
      { p: [32, 30, -184], s: [30, 60, 26] },
      { p: [-74, 33, -210], s: [40, 66, 30] },
      { p: [78, 30, -216], s: [44, 60, 30] },
    ]
    const bMat = streetMat({ map: A.brick.dark.map, color: '#8a7b78', roughness: 1, aoBase: 0.7 })
    const bGeos = blocks.map((b) => {
      const g = new THREE.BoxGeometry(...b.s)
      worldUV(g, 2.4, ...b.p)
      return g
    })
    return { layers, blocks, bMat, bGeos }
  }, [])

  useFrame(() => {
    kit.layers.forEach((l, i) => {
      l.sil.color.copy(palette.skyMid).lerp(palette.fog, 0.6).multiplyScalar(0.34 - i * 0.03)
      l.sil.color.lerp(palette.horizon, 0.07 + i * 0.1)
      l.lit.opacity = palette.windows * (0.38 - i * 0.07)
    })
  }, -1)

  useEffect(() => () => { kit.layers.forEach((l) => { l.geo.dispose(); l.sil.dispose(); l.lit.dispose() }); kit.bMat.dispose(); kit.bGeos.forEach((g) => g.dispose()) }, [kit])

  return (
    <group position={origin}>
      {kit.layers.map((l, i) => (
        <group key={i} position={[0, l.w / 8 - 6, z[i]]}>
          <mesh geometry={l.geo} material={l.sil} renderOrder={-50 + i} />
          <mesh geometry={l.geo} material={l.lit} position={[0, 0, 0.1]} renderOrder={-40 + i} />
        </group>
      ))}
      {withBlocks && kit.blocks.map((b, i) => (
        <mesh key={i} geometry={kit.bGeos[i]} material={kit.bMat} position={b.p} />
      ))}
    </group>
  )
}
