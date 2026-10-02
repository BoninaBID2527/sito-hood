'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { clamp, damp, smoothstep } from '@/lib/math'
import { CP, WORLD } from '@/lib/timeline'
import { createArtworkMaterial } from './ArtworkMaterial'
import { useStore } from '@/lib/store'

/**
 * The official ALTERCO artwork as a physical object: a thin sleeve with a shader that
 * lets it dissolve out of the fog, drift like water and split RGB — never distorting it beyond recognition.
 */
export function AltercoArtwork({ mode, position, size = 3.6 }: { mode: 'plaza' | 'final'; position?: [number, number, number]; size?: number }) {
  const group = useRef<THREE.Group>(null)
  const front = useMemo(() => createArtworkMaterial(A.covers.alterco), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.8 }), [])
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: A.covers.alterco, color: '#555', roughness: 0.9 }), [])
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 0.045), [])
  const tilt = useRef({ x: 0, y: 0 })
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: A.glow, color: mode === 'final' ? '#9ab4ff' : '#ffb27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }), [mode])

  useEffect(() => () => { front.dispose(); dark.dispose(); back.dispose(); geo.dispose(); halo.dispose() }, [front, dark, back, geo, halo])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const p = rt.smooth
    const u = front.uniforms
    u.uTime.value = rt.time
    u.uGrain.value = 0.8 + rt.fx.contam
    tilt.current.x = damp(tilt.current.x, rt.px, 2.5, dt)
    tilt.current.y = damp(tilt.current.y, rt.py, 2.5, dt)
    u.uTilt.value.set(tilt.current.x, tilt.current.y)
    const S = rt.reducedMotion ? 0 : 1

    if (mode === 'plaza') {
      // emerges from the fog as the orbit assembles, then swells at the ALTERCO reveal
      const reveal = smoothstep(CP.tracksStart - 0.06, CP.tracksStart + 0.07, p)
      const swell = smoothstep(0.58, CP.reveal + 0.02, p)
      u.uReveal.value = reveal
      u.uFlow.value = 0.25 + swell * 1.3 + rt.fx.contam * 0.6
      u.uSplit.value = 0.0015 + swell * 0.01 + rt.fx.contam * 0.004
      u.uGlow.value = 0.3 + swell
      u.uBulge.value = 1 + swell * 3
      const s = size * (1 + swell * 0.55)
      g.scale.set(s, s, 1)
      g.position.set(WORLD.plazaCenter.x, WORLD.plazaCenter.y + Math.sin(rt.time * 0.6) * 0.06 * S - swell * 0.2, WORLD.plazaCenter.z)
      g.rotation.set(-tilt.current.y * 0.07 * S, tilt.current.x * 0.12 * S + Math.sin(rt.time * 0.3) * 0.03 * S, 0)
      halo.opacity = reveal * (0.1 + swell * 0.3)
      g.visible = rt.world === 'alley' && p > CP.tracksStart - 0.08 && p < 0.74
    } else {
      const sel = useStore.getState().visited.length === 7
      u.uReveal.value = smoothstep(0.8, 0.93, p)
      u.uFlow.value = 0.35 + rt.fx.contam
      u.uSplit.value = 0.0018 + rt.fx.contam * 0.004
      u.uGlow.value = sel ? 1.2 : 0.5
      u.uBulge.value = 1
      g.scale.set(size, size, 1)
      const [x, y, z] = position!
      g.position.set(x, y + Math.sin(rt.time * 0.5) * 0.12 * S, z)
      g.rotation.set(-tilt.current.y * 0.05 * S, -0.12 + tilt.current.x * 0.1 * S + Math.sin(rt.time * 0.25) * 0.04 * S, 0)
      halo.opacity = smoothstep(0.8, 0.95, p) * (0.2 + (sel ? 0.25 : 0))
      g.visible = rt.world === 'roof'
    }
    void clamp
  }, -0.5)

  return (
    <group ref={group}>
      <mesh geometry={geo} material={[dark, dark, dark, dark, front, back]} />
      <sprite material={halo} scale={[2.6, 2.6, 1]} position={[0, 0, -0.1]} />
    </group>
  )
}
