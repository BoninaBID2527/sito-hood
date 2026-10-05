'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { palette } from '@/lib/timeOfDay'
import { streetMat } from './materials'
import { createTowerMaterial, updateTowerMaterial } from '@/effects/TowerMaterial'
import { buildCity } from './cityBlocks'

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
    // the near / mid city: stepped towers with cornices and roof plant, merged into one mesh (see cityBlocks.ts)
    const bMat = createTowerMaterial()
    const city = withBlocks ? buildCity() : null
    return { layers, city, bMat }
  }, [])

  useFrame(() => {
    updateTowerMaterial(kit.bMat)
    kit.layers.forEach((l, i) => {
      l.sil.color.copy(palette.skyMid).lerp(palette.fog, 0.6).multiplyScalar(0.34 - i * 0.03)
      l.sil.color.lerp(palette.horizon, 0.07 + i * 0.1)
      l.lit.opacity = palette.windows * (0.38 - i * 0.07)
    })
  }, -1)

  useEffect(() => () => { kit.layers.forEach((l) => { l.geo.dispose(); l.sil.dispose(); l.lit.dispose() }); kit.bMat.dispose(); kit.city?.dispose() }, [kit])

  return (
    <group position={origin}>
      {kit.layers.map((l, i) => (
        <group key={i} position={[0, l.w / 8 - 6, z[i]]}>
          <mesh geometry={l.geo} material={l.sil} renderOrder={-50 + i} />
          <mesh geometry={l.geo} material={l.lit} position={[0, 0, 0.1]} renderOrder={-40 + i} />
        </group>
      ))}
      {kit.city && <mesh geometry={kit.city} material={kit.bMat} frustumCulled={false} />}
    </group>
  )
}
