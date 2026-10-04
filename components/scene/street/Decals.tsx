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
    const mk = (tex: THREE.Texture, glow = 0.6) =>
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: glow })
    return {
      plane,
      alterco: mk(A.signs.alterco, 0.9),
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
      <group position={[bladeX - 1.05, 5.0, -31]}>
        <mesh geometry={built.plane} material={built.alterco} scale={[1.7, 0.85, 1]} />
        <mesh geometry={built.barGeo} material={built.bar} position={[0.9, 0.5, 0]} scale={[1, 1, 1.0]} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={built.barGeo} material={built.bar} position={[0.55, 0, 0]} scale={[1, 1, 2.0]} rotation={[0, Math.PI / 2, 0]} />
      </group>
      {/* TRACKS → at the mouth of the plaza */}
      <mesh geometry={built.plane} material={built.tracks} position={[wallX(-1, -67) + 0.09, 3.1, -67]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.1, 1]} />
      {/* roof access (the way out — nav hint) */}
      <mesh geometry={built.plane} material={built.roof} position={[wallX(1, -68) - 0.09, 4.6, -68]} rotation={[0, -Math.PI / 2, 0]} scale={[2.4, 0.9, 1]} />
      <mesh geometry={built.plane} material={built.oneWay} position={[wallX(-1, -10) + 0.08, 2.5, -10.5]} rotation={[0, Math.PI / 2, 0]} scale={[1.1, 0.34, 1]} />
    </group>
  )
}

/** HOODDINO banner hung across the alley + ALTERCO light-projected onto the brick. */
function WorldTitles() {
  const bannerGeo = useMemo(() => new THREE.PlaneGeometry(5.7, 1.43, 28, 6), [])
  const base = useMemo(() => Float32Array.from(bannerGeo.attributes.position.array as Float32Array), [bannerGeo])
  const bannerMat = useMemo(() => new THREE.MeshStandardMaterial({ map: A.banner, roughness: 0.85, side: THREE.DoubleSide }), [])
  const projMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: A.projection, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color('#ffe2b4'), opacity: 0.0, fog: false }),
    [],
  )
  const projGeo = useMemo(() => new THREE.PlaneGeometry(13, 3.25), [])
  const cableMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0a0a' }), [])
  const cableGeo = useMemo(() => new THREE.CylinderGeometry(0.014, 0.014, 1, 4), [])
  const bannerRef = useRef<THREE.Mesh>(null)

  useWorldFrame('alley', () => {
    const pos = bannerGeo.attributes.position as THREE.BufferAttribute
    const t = rt.time
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1]
      pos.setZ(i, Math.sin(x * 1.4 + t * 1.2) * 0.07 + Math.sin(x * 3.1 - t * 0.8) * 0.02 + (1 - Math.abs(x) / 2.85) * 0.04 * Math.sin(t * 0.5 + y))
      pos.setY(i, y - Math.pow(x / 2.85, 2) * 0.0 - (1 - Math.pow(x / 2.85, 2)) * 0.0)
    }
    pos.needsUpdate = true
    // the projection "breathes" and misregisters now and then
    const flick = 0.5 + 0.12 * Math.sin(rt.time * 9.0) * Math.sin(rt.time * 2.3) + (Math.sin(rt.time * 0.7) > 0.96 ? -0.3 : 0)
    projMat.opacity = Math.max(0, flick) * (0.35 + palette.lamps * 0.65) * (0.7 + rt.fx.contam * 0.6)
  })
  useEffect(() => () => { bannerGeo.dispose(); bannerMat.dispose(); projMat.dispose(); projGeo.dispose(); cableMat.dispose(); cableGeo.dispose() }, [bannerGeo, bannerMat, projMat, projGeo, cableMat, cableGeo])

  // cables from banner corners up to the walls
  const cableSegs = useMemo(() => {
    const out: { p: THREE.Vector3; q: THREE.Quaternion; len: number }[] = []
    const z = -26, y = 7.4
    const hwL = -3.0, hwR = 2.9
    const pairs: [[number, number], [number, number]][] = [
      [[-2.85, y + 0.7], [hwL, y + 1.6]],
      [[2.85, y + 0.7], [hwR, y + 1.6]],
      [[-2.85, y - 0.7], [hwL, y - 0.4]],
      [[2.85, y - 0.7], [hwR, y - 0.4]],
    ]
    for (const [a, b] of pairs) {
      const A3 = new THREE.Vector3(a[0], a[1], z), B3 = new THREE.Vector3(b[0], b[1], z)
      const dir = B3.clone().sub(A3)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
      out.push({ p: A3.clone().add(B3).multiplyScalar(0.5), q, len: dir.length() })
    }
    return out
  }, [])

  return (
    <group>
      <mesh ref={bannerRef} geometry={bannerGeo} material={bannerMat} position={[0.04, 7.4, -26]} rotation={[0.05, 0, 0]} />
      {cableSegs.map((c, i) => (
        <mesh key={i} geometry={cableGeo} material={cableMat} position={c.p} quaternion={c.q} scale={[1, c.len, 1]} />
      ))}
      <mesh geometry={projGeo} material={projMat} position={[wallX(1, -36) - 0.12, 7.4, -36]} rotation={[0, -Math.PI / 2, 0]} renderOrder={5} />
    </group>
  )
}

const LETTER_SPOTS: { side: -1 | 1; z: number; y: number; s: number }[] = [
  { side: -1, z: 5.5, y: 1.15, s: 0.55 },
  { side: 1, z: -8.8, y: 3.4, s: 0.6 },
  { side: -1, z: -20.5, y: 2.1, s: 0.55 },
  { side: 1, z: -33.5, y: 1.0, s: 0.5 },
  { side: -1, z: -45, y: 3.7, s: 0.6 },
  { side: 1, z: -57.5, y: 1.9, s: 0.55 },
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
        <group position={[wallX(l.side, l.z) - l.side * (0.09 + i * 0.001), l.y, l.z]} rotation={[0, rotFor(l.side), (i % 2 ? 1 : -1) * 0.06]}>
          <mesh geometry={geo} material={letterMats[i]} scale={[l.s, l.s, 1]} renderOrder={4} />
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
