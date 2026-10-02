'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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
        m = streetMat({ map: tex, transparent: true, depthWrite: false, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, aoBase: 0.55 })
        cache.set(tex, m)
      }
      return m
    }
    return { get, dispose: () => cache.forEach((m) => m.dispose()) }
  }, [])
}

export function Decals() {
  const mats = useDecalMats()
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  const defs = useMemo(() => {
    const r = rng(77)
    const d: DecalDef[] = []
    // large graffiti pieces — the walls' main voice
    const pieces: [-1 | 1, number, number, number, number, number][] = [
      [-1, 7, 3.2, 5.2, 3.25, 0],
      [1, -15, 3.0, 5.4, 3.4, 1],
      [-1, -29, 2.8, 4.8, 3.0, 2],
      [1, -49, 3.1, 5.0, 3.1, 3],
      [-1, -62, 2.9, 4.6, 2.9, 4],
      [-1, -90, 3.6, 8.5, 5.3, 4],
      [1, -86, 3.4, 7.5, 4.7, 0],
      [-1, -104, 3.4, 8, 5, 1],
      [1, -108, 3.4, 7.5, 4.7, 2],
    ]
    pieces.forEach(([side, z, y, w, h, t], i) => d.push({ side, z, y, w, h, tex: A.pieces[t], off: OFF + i * 0.0004, rot: r.range(-0.03, 0.03) }))
    // small tags
    for (let i = 0; i < 26; i++) {
      const side = (r() < 0.5 ? -1 : 1) as -1 | 1
      const z = r.range(20, -72)
      const upper = r() < 0.35
      const w = r.range(0.9, 1.7)
      d.push({ side, z, y: upper ? r.range(4.6, 9) : r.range(0.55, 1.4), w, h: w * 0.6, tex: A.pieces[r.int(0, 4)], off: OFF + 0.001 * i, rot: r.range(-0.2, 0.2), order: 1 })
    }
    // paste-up posters (track lyrics-style typography)
    const clusters: [-1 | 1, number][] = [[-1, 15], [1, 3], [-1, -9], [1, -24], [-1, -20], [1, -41], [-1, -45], [1, -55], [-1, -56], [-1, -70], [1, -70]]
    clusters.forEach(([side, zc], ci) => {
      const n = r.int(2, 4)
      for (let i = 0; i < n; i++) {
        const w = r.range(0.75, 1.0)
        d.push({ side, z: zc + (i - n / 2) * 0.82 + r.range(-0.2, 0.2), y: r.range(1.55, 2.55), w, h: w * 1.5, tex: A.posters[(ci + i) % A.posters.length], rot: r.range(-0.07, 0.07), off: OFF + 0.002 * (ci * 4 + i), order: 2 })
      }
    })
    return d
  }, [])

  useEffect(() => () => { mats.dispose(); geo.dispose() }, [mats, geo])

  return (
    <group>
      {defs.map((d, i) => {
        const x = wallX(d.side, d.z) - d.side * (d.off ?? OFF)
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mats.get(d.tex)}
            position={[x, d.y, d.z]}
            rotation={[0, rotFor(d.side), d.rot ?? 0]}
            scale={[d.w, d.h, 1]}
            renderOrder={d.order ?? 0}
          />
        )
      })}
      <Signs />
      <WorldTitles />
      <EasterEggs />
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
  useFrame(() => {
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

  useFrame(() => {
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
  const stencilMat = useMemo(() => new THREE.MeshStandardMaterial({ map: A.stencils.five, transparent: true, depthWrite: false, roughness: 0.9, emissive: new THREE.Color('#ffd9a0'), emissiveMap: A.stencils.five, emissiveIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const creditsMat = useMemo(() => new THREE.MeshStandardMaterial({ map: A.creditsPoster, transparent: true, roughness: 0.9, emissive: new THREE.Color('#fff'), emissiveMap: A.creditsPoster, emissiveIntensity: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const hov = useRef({ letter: -1, stencil: false, credits: false })
  useEffect(() => () => { geo.dispose(); letterMats.forEach((m) => m.dispose()); stencilMat.dispose(); creditsMat.dispose() }, [geo, letterMats, stencilMat, creditsMat])

  useFrame((_, dt) => {
    letterMats.forEach((m, i) => {
      const target = letters[i] ? 1.1 : hov.current.letter === i ? 0.7 : 0
      m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 8)
    })
    stencilMat.emissiveIntensity += ((hov.current.stencil ? 1 : 0.05) - stencilMat.emissiveIntensity) * Math.min(1, dt * 8)
    creditsMat.emissiveIntensity += ((hov.current.credits ? 0.35 : 0) - creditsMat.emissiveIntensity) * Math.min(1, dt * 8)
  })

  const fe = FIRE_ESCAPES.find((f) => f.side === 1 && f.z === -37)!
  const fx = wallX(1, fe.z)
  const set = useStore.getState().setCursor

  return (
    <group>
      {LETTER_SPOTS.map((l, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={letterMats[i]}
          position={[wallX(l.side, l.z) - l.side * (0.09 + i * 0.001), l.y, l.z]}
          rotation={[0, rotFor(l.side), (i % 2 ? 1 : -1) * 0.06]}
          scale={[l.s, l.s, 1]}
          renderOrder={4}
          onPointerOver={(e) => { e.stopPropagation(); hov.current.letter = i; if (!rt.touch) foundLetter(i); set('link', 'TAG') }}
          onPointerOut={() => { hov.current.letter = -1; set('default') }}
          onClick={(e) => { e.stopPropagation(); foundLetter(i) }}
        />
      ))}

      {/* a number someone stencilled on the fire escape */}
      <mesh
        geometry={geo}
        material={stencilMat}
        position={[fx - 0.09, Y0 + 1.5, fe.z + 0.55]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[0.55, 0.55, 1]}
        renderOrder={4}
        onPointerOver={(e) => {
          e.stopPropagation()
          hov.current.stencil = true
          set('link', '05')
          const t = alterco.tracks[4]
          useStore.getState().say(`${pad(t.n)} — ${t.title.toUpperCase()}`, 'Someone stencilled this on the fire escape.')
        }}
        onPointerOut={() => { hov.current.stencil = false; set('default') }}
      />

      {/* credits wheat-paste, half hidden behind a dumpster in the plaza */}
      <mesh
        geometry={geo}
        material={creditsMat}
        position={[11.93, 1.75, -93.1]}
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
