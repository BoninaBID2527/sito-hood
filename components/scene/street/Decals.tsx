'use client'

import { useWorldFrame } from '@/hooks/useWorldFrame'
import { DistCull } from './DistCull'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rng } from '@/lib/math'
import { rt } from '@/lib/runtime'
import { palette } from '@/lib/timeOfDay'
import { useStore } from '@/lib/store'
import { foundLetter, openCredits } from '@/lib/actions'
import { streetMat } from './materials'
import { wallX } from './layout'
import { FIRE_ESCAPES, Y0 } from './FireEscapes'
import { PortalPoster } from '../PortalPoster'
import { GrazingSymbol } from './GrazingSymbol'
import { StreetGraffiti } from './StreetGraffiti'
import { NumberTrail } from './NumberTrail'
import { Anamorph } from './Anamorph'
import { StreetMemory } from './StreetMemory'
import { alterco, pad } from '@/data/project'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)
const OFF = 0.075

interface DecalDef {
  side: -1 | 1
  z: number
  y: number
  w: number
  h: number
  tex: THREE.Texture
  rot?: number
  off?: number
  order?: number
}

function useDecalMats() {
  return useMemo(() => {
    const cache = new Map<THREE.Texture, THREE.MeshStandardMaterial>()
    const get = (tex: THREE.Texture) => {
      let m = cache.get(tex)
      if (!m) {
        m = streetMat({ map: tex, transparent: true, depthWrite: false, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, aoBase: 0.55, decal: true, macro: 0.85 })
        cache.set(tex, m)
      }
      return m
    }
    return { get, dispose: () => cache.forEach((m) => m.dispose()) }
  }, [])
}

export function Decals() {
  return (
    <group>
      <StreetGraffiti />
      <Signs />
      <WorldTitles />
      <EasterEggs />
      <DistCull at={[-3, 1.2, -33]} r={75}><GrazingSymbol /></DistCull>
      <NumberTrail />
      <DistCull at={[0, 0, -21]} r={55}><Anamorph /></DistCull>
      <DistCull at={[0, 1, -48]} r={75}><StreetMemory /></DistCull>
    </group>
  )
}

/** Signage — nav as physical urban signs. */
function Signs() {
  const built = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1)
    const mk = (tex: THREE.Texture, glow = 0.6, blade = false) => {
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: glow })
      if (blade) {
        // A printed blade has readable faces in both approach directions. Reuse
        // the existing plane/map; only the back-face sampling needs reversing.
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('vMapUv', '(gl_FrontFacing ? vMapUv : vec2(1.0 - vMapUv.x, vMapUv.y))'))
            .replace('#include <emissivemap_fragment>', THREE.ShaderChunk.emissivemap_fragment.replace('vEmissiveMapUv', '(gl_FrontFacing ? vEmissiveMapUv : vec2(1.0 - vEmissiveMapUv.x, vEmissiveMapUv.y))'))
        }
        mat.customProgramCacheKey = () => 'hooddino-blade-readable-faces-v1'
      }
      return mat
    }
    return {
      plane,
      alterco: mk(A.signs.alterco, 0.9, true),
      tracks: mk(A.signs.tracks, 0.5),
      roof: mk(A.signs.roof, 0.7),
      oneWay: mk(A.signs.oneWay, 0.2),
      bar: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.5, metalness: 0.7 }),
      barGeo: new THREE.BoxGeometry(0.05, 0.05, 1),
    }
  }, [])
  const refs = useRef<THREE.MeshStandardMaterial[]>([])
  useWorldFrame('alley', () => {
    const k = 0.25 + palette.lamps * 0.9
    built.alterco.emissiveIntensity = 0.5 * k + 0.35
    built.tracks.emissiveIntensity = 0.3 * k
    built.roof.emissiveIntensity = 0.4 * k
    void refs
  })
  useEffect(() => () => { built.plane.dispose(); built.alterco.dispose(); built.tracks.dispose(); built.roof.dispose(); built.oneWay.dispose(); built.bar.dispose(); built.barGeo.dispose() }, [built])

  const bladeX = wallX(1, -31)
  return (
    <group>
      {/* blade sign perpendicular to the wall — readable head-on while walking down the alley */}
      <DistCull at={[bladeX, 5, -31]} r={58}>
      <group position={[bladeX - 1.05, 5.0, -31]}>
        <mesh geometry={built.plane} material={built.alterco} scale={[1.7, 0.85, 1]} />
        {/* Two short brackets connect the rear edge (x=.85) to the wall (x=1.05), behind the printed face. */}
        <mesh geometry={built.barGeo} material={built.bar} position={[0.94, 0.3, -0.06]} scale={[1, 1, 0.22]} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={built.barGeo} material={built.bar} position={[0.94, -0.3, -0.06]} scale={[1, 1, 0.22]} rotation={[0, Math.PI / 2, 0]} />
      </group>
      </DistCull>
      {/* TRACKS → at the mouth of the plaza */}
      <mesh geometry={built.plane} material={built.tracks} position={[wallX(-1, -69.4) + 0.006, 1.5, -69.4]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.1, 1]} />
      {/* roof access (the way out — nav hint) */}
      <mesh geometry={built.plane} material={built.roof} position={[wallX(1, -67.3) - 0.006, 1.4, -67.3]} rotation={[0, -Math.PI / 2, 0]} scale={[2.4, 0.9, 1]} />
      <DistCull at={[wallX(-1, -9.8), 2.0, -9.8]} r={58}>
        <mesh geometry={built.plane} material={built.oneWay} position={[wallX(-1, -9.8) + 0.006, 2.0, -9.8]} rotation={[0, Math.PI / 2, 0]} scale={[1.1, 0.34, 1]} />
      </DistCull>
    </group>
  )
}

/**
 * The two monumental titles of the journey are physical objects in the alley: a HOODDINO banner hung across it (z −26) and an ALTERCO
 * banner further in (z −50), each on four cables to the fire escapes, lit by the evening; plus ALTERCO light-projected onto the brick.
 * (V3.4: these replace the old screen-space DOM words, which floated in front of the lens and covered the lower viewport on tablets.)
 */
const BANNERS = [
  { z: -26, y: 7.4, x: 0.04, tex: 'banner' as const, sway: 0 },
  { z: -50, y: 6.6, x: -0.12, tex: 'banner2' as const, sway: 1.7 },
]

function HungBanner({ z, y, x, tex, sway }: (typeof BANNERS)[number]) {
  const geo = useMemo(() => new THREE.PlaneGeometry(5.7, 1.43, 28, 6), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: A[tex], roughness: 0.85, side: THREE.DoubleSide }), [tex])
  const cableMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0a0a' }), [])
  const cableGeo = useMemo(() => new THREE.CylinderGeometry(0.014, 0.014, 1, 4), [])
  useWorldFrame('alley', () => {
    // the cloth breathes (only while the street is on screen, and only near the camera — DistCull hides it otherwise)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const t = rt.time + sway
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1]
      pos.setZ(i, Math.sin(bx * 1.4 + t * 1.2) * 0.07 + Math.sin(bx * 3.1 - t * 0.8) * 0.02 + (1 - Math.abs(bx) / 2.85) * 0.04 * Math.sin(t * 0.5 + by))
    }
    pos.needsUpdate = true
  })
  useEffect(() => () => { geo.dispose(); mat.dispose(); cableMat.dispose(); cableGeo.dispose() }, [geo, mat, cableMat, cableGeo])
  // cables from the banner corners up to the walls
  const cableSegs = useMemo(() => {
    const out: { p: THREE.Vector3; q: THREE.Quaternion; len: number }[] = []
    const hwL = wallX(-1, z) + 0.1, hwR = wallX(1, z) - 0.1
    const pairs: [[number, number], [number, number]][] = [
      [[-2.85 + x, y + 0.7], [hwL, y + 1.6]],
      [[2.85 + x, y + 0.7], [hwR, y + 1.6]],
      [[-2.85 + x, y - 0.7], [hwL, y - 0.4]],
      [[2.85 + x, y - 0.7], [hwR, y - 0.4]],
    ]
    for (const [a, b] of pairs) {
      const A3 = new THREE.Vector3(a[0], a[1], z), B3 = new THREE.Vector3(b[0], b[1], z)
      const dir = B3.clone().sub(A3)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
      out.push({ p: A3.clone().add(B3).multiplyScalar(0.5), q, len: dir.length() })
    }
    return out
  }, [x, y, z])
  return (
    <DistCull at={[0, y, z]} r={58}>
      <mesh geometry={geo} material={mat} position={[x, y, z]} rotation={[0.05, 0, 0]} />
      {cableSegs.map((c, i) => (
        <mesh key={i} geometry={cableGeo} material={cableMat} position={c.p} quaternion={c.q} scale={[1, c.len, 1]} />
      ))}
    </DistCull>
  )
}

function WorldTitles() {
  const projMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: A.projection, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color('#ffe2b4'), opacity: 0.0, fog: false }),
    [],
  )
  const projGeo = useMemo(() => new THREE.PlaneGeometry(13, 3.25), [])
  useWorldFrame('alley', () => {
    // the projection "breathes" and misregisters now and then
    const flick = 0.5 + 0.12 * Math.sin(rt.time * 9.0) * Math.sin(rt.time * 2.3) + (Math.sin(rt.time * 0.7) > 0.96 ? -0.3 : 0)
    projMat.opacity = Math.max(0, flick) * (0.35 + palette.lamps * 0.65) * (0.7 + rt.fx.contam * 0.6)
  })
  useEffect(() => () => { projMat.dispose(); projGeo.dispose() }, [projMat, projGeo])
  return (
    <group>
      {BANNERS.map((b) => <HungBanner key={b.tex} {...b} />)}
      <DistCull at={[wallX(1, -36), 7.4, -36]} r={58}>
        <mesh geometry={projGeo} material={projMat} position={[wallX(1, -36) - 0.12, 7.4, -36]} rotation={[0, -Math.PI / 2, 0]} renderOrder={5} />
      </DistCull>
    </group>
  )
}

const LETTER_SPOTS: { side: -1 | 1; z: number; y: number; s: number }[] = [
  { side: -1, z: 5.5, y: 1.15, s: 0.55 },
  { side: 1, z: -8.8, y: 3.4, s: 0.6 },
  { side: -1, z: -22.1, y: 2.1, s: 0.55 },
  { side: 1, z: -32.8, y: 1.0, s: 0.5 },
  { side: -1, z: -45, y: 3.7, s: 0.6 },
  { side: 1, z: -56.2, y: 1.9, s: 0.55 },
  { side: 1, z: -91, y: 2.2, s: 0.7 },
]

/** Easter eggs that live on the walls: hidden ALTERCO letters, fire-escape number, credits poster, DUALISMO portal. */
function EasterEggs() {
  const letters = useStore((s) => s.letters)
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const letterMats = useMemo(
    () => A.letters.map((t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    [],
  )
  const creditsMat = useMemo(() => new THREE.MeshStandardMaterial({ map: A.creditsPoster, transparent: true, roughness: 0.9, emissive: new THREE.Color('#fff'), emissiveMap: A.creditsPoster, emissiveIntensity: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const hov = useRef({ letter: -1, credits: false })
  useEffect(() => () => { geo.dispose(); letterMats.forEach((m) => m.dispose()); creditsMat.dispose() }, [geo, letterMats, creditsMat])

  useWorldFrame('alley', (_, dt) => {
    letterMats.forEach((m, i) => {
      const target = letters[i] ? 1.1 : hov.current.letter === i ? 0.7 : 0
      m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 8)
    })
    creditsMat.emissiveIntensity += ((hov.current.credits ? 0.35 : 0) - creditsMat.emissiveIntensity) * Math.min(1, dt * 8)
  })

  const set = useStore.getState().setCursor

  return (
    <group>
      {LETTER_SPOTS.map((l, i) => (
        <DistCull key={i} at={[wallX(l.side, l.z), l.y, l.z]} r={65}>
        {/* Paint and picking share one transform; the clue cannot remain as a detached hit area at its old position. */}
        <group position={[wallX(l.side, l.z) - l.side * (0.004 + i * 0.0001), l.y, l.z]} rotation={[0, rotFor(l.side), (i % 2 ? 1 : -1) * 0.06]}>
          <mesh name={`hooddino-letter-${i}`} geometry={geo} material={letterMats[i]} scale={[l.s, l.s, 1]} renderOrder={4} />
          {/* generous invisible hit area — the glyphs are small and far away */}
          <mesh
            geometry={geo}
            scale={[l.s * 2.4, l.s * 2.4, 1]}
            position={[0, 0, 0.02]}
            onPointerOver={(e) => { e.stopPropagation(); hov.current.letter = i; if (!rt.touch) foundLetter(i); set('link', 'TAG') }}
            onPointerOut={() => { hov.current.letter = -1; set('default') }}
            onClick={(e) => { e.stopPropagation(); foundLetter(i) }}
          >
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
        </DistCull>
      ))}

      {/* credits wheat-paste, half hidden behind a dumpster in the plaza */}
      <mesh
        geometry={geo}
        material={creditsMat}
        position={[11.93, 1.75, -110.4]}
        rotation={[0, -Math.PI / 2, 0.02]}
        scale={[1.0, 1.35, 1]}
        renderOrder={4}
        onPointerOver={(e) => { e.stopPropagation(); hov.current.credits = true; set('link', 'READ') }}
        onPointerOut={() => { hov.current.credits = false; set('default') }}
        onClick={(e) => { e.stopPropagation(); openCredits() }}
      />

      <PortalPoster position={[wallX(-1, -50.2) + 0.1, 2.45, -50.2]} rotationY={Math.PI / 2} />
    </group>
  )
}
