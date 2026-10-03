'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { palette } from '@/lib/timeOfDay'
import { useStore } from '@/lib/store'
import { smoothstep } from '@/lib/math'
import { cellGeometry } from './atlasDecals'
import { wallX } from './layout'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)

/**
 * Two pieces of UV paint on the street walls — invisible by day.
 *  · the scrawl comes up as the light goes (reactive paint, part of the passage of time),
 *  · after the visitor has been to DUALISMO and come back, it never fully goes out again, and a small glyph appears
 *    low on the opposite wall that was not there before. No explanation, no prompt.
 */
export function StreetMemory() {
  const kit = useMemo(() => {
    const G = A.graf
    const mk = (cell: (typeof G.spr)[string]) => ({
      geo: cellGeometry(cell),
      mat: new THREE.MeshStandardMaterial({ map: G.sprayTex, transparent: true, depthWrite: false, roughness: 0.9, emissive: new THREE.Color('#7ab8ff'), emissiveMap: G.sprayTex, emissiveIntensity: 0, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      aspect: cell.aspect,
    })
    return { uv: mk(G.spr.uv_tag), glyph: mk(G.spr.glyph) }
  }, [])
  useEffect(() => () => Object.values(kit).forEach((k) => { k.geo.dispose(); k.mat.dispose() }), [kit])

  const lvl = useRef({ uv: 0, glyph: 0 })
  useFrame((_, dt) => {
    const mem = useStore.getState().dualReturned
    // dusk: window-light rises through the journey → paint wakes up. Memory keeps it half-awake.
    const dusk = smoothstep(0.35, 0.8, palette.windows)
    const uv = Math.max(dusk, mem ? 0.5 : 0)
    const g = mem ? 0.55 + 0.45 * smoothstep(0.2, 0.8, palette.windows) : 0
    lvl.current.uv += (uv - lvl.current.uv) * Math.min(1, dt * 0.8)
    lvl.current.glyph += (g - lvl.current.glyph) * Math.min(1, dt * 0.6)
    const k = kit.uv.mat, gl = kit.glyph.mat
    k.opacity = 0.05 + lvl.current.uv * 0.9
    k.emissiveIntensity = lvl.current.uv * (1.1 + (mem ? 0.5 * (0.5 + 0.5 * Math.sin(rt.time * 0.6)) : 0))
    gl.opacity = lvl.current.glyph * 0.9
    gl.emissiveIntensity = lvl.current.glyph * 1.6
  })

  const w1 = 0.95, w2 = 0.15
  return (
    <group>
      <mesh geometry={kit.uv.geo} material={kit.uv.mat} position={[wallX(1, -35) - 0.082, 1.2, -35]} rotation={[0, rotFor(1), -0.06]} scale={[w1, w1 / kit.uv.aspect, 1]} renderOrder={5} />
      <mesh geometry={kit.glyph.geo} material={kit.glyph.mat} position={[wallX(-1, -61.5) + 0.082, 0.46, -61.5]} rotation={[0, rotFor(-1), 0.04]} scale={[w2, w2, 1]} renderOrder={5} />
    </group>
  )
}
