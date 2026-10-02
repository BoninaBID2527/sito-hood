'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { GeoBuilder, tileUV, worldUV } from '@/lib/geo'
import { rng } from '@/lib/math'
import { rt } from '@/lib/runtime'
import { palette } from '@/lib/timeOfDay'
import { WORLD, CP } from '@/lib/timeline'
import { useStore } from '@/lib/store'
import { enterDualism } from '@/lib/actions'
import { streetMat } from './street/materials'
import { Backdrop } from './street/Backdrop'
import { Steam } from './street/Atmos'
import { AltercoArtwork } from './AltercoArtwork'
import { alterco, pad } from '@/data/project'

const R = WORLD.roofX
const ROOF = { x0: -10, x1: 16, z0: 12, z1: -24 }

function brickMat(kind: 'red' | 'dark' | 'weathered' | 'concrete' | 'plaster', tint = '#ffffff', tile = 2.4) {
  void tile
  return streetMat({ map: A.brick[kind].map, color: tint, roughness: 0.95, aoBase: 0.55 })
}

export function RooftopEnvironment() {
  const kit = useMemo(() => {
    const disposables: { dispose(): void }[] = []
    const keep = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d)

    // deck
    const deckGeo = keep(new THREE.PlaneGeometry(44, 64))
    tileUV(deckGeo, 44, 64, 3.4)
    const deckMat = keep(streetMat({ map: A.roofDeck, color: '#d6d9e0', roughness: 0.82, aoBase: 0.7 }))

    // parapets
    const concrete = keep(brickMat('concrete', '#cfcac2'))
    const brick = keep(brickMat('red', '#d8c4b6'))
    const par = new GeoBuilder()
    const cap = new GeoBuilder()
    const W = ROOF.x1 - ROOF.x0, D = ROOF.z0 - ROOF.z1, cx = (ROOF.x0 + ROOF.x1) / 2, cz = (ROOF.z0 + ROOF.z1) / 2
    par.box(W + 1, 1.05, 0.5, cx, 0.525, ROOF.z1 - 0.25).box(W + 1, 1.05, 0.5, cx, 0.525, ROOF.z0 + 0.25)
    par.box(0.5, 1.05, D + 1, ROOF.x0 - 0.25, 0.525, cz).box(0.5, 1.05, D + 1, ROOF.x1 + 0.25, 0.525, cz)
    cap.box(W + 1.4, 0.12, 0.9, cx, 1.11, ROOF.z1 - 0.25).box(W + 1.4, 0.12, 0.9, cx, 1.11, ROOF.z0 + 0.25)
    cap.box(0.9, 0.12, D + 1.4, ROOF.x0 - 0.25, 1.11, cz).box(0.9, 0.12, D + 1.4, ROOF.x1 + 0.25, 1.11, cz)
    const parGeo = keep(par.build())
    const capGeo = keep(cap.build())
    const capMat = keep(streetMat({ color: '#777570', roughness: 0.9, aoBase: 0.6 }))

    // bulkhead (stair house) — brick, door, lamp
    const bulk = keep(new THREE.BoxGeometry(5, 3.6, 4))
    worldUV(bulk, 2.4, -6, 1.8, 2)
    // water tank
    const wood = new GeoBuilder()
    const iron = new GeoBuilder()
    const tx = 10, tz = -6
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) iron.cyl(0.08, 0.08, 2.4, tx + dx, 1.2, tz + dz, 8)
    iron.cyl(1.7, 1.7, 0.12, tx, 2.4, tz, 18)
    wood.cyl(1.55, 1.7, 2.9, tx, 3.9, tz, 20)
    for (const y of [2.8, 3.7, 4.6]) iron.add(new THREE.TorusGeometry(1.62 + (y < 3 ? 0.07 : 0), 0.04, 6, 24), tx, y, tz, Math.PI / 2, 0, 0)
    wood.add(new THREE.ConeGeometry(1.85, 1.1, 20), tx, 5.9, tz)
    for (let y = 2.5; y < 5.2; y += 0.3) iron.box(0.5, 0.025, 0.025, tx + 1.8, y, tz + 0.4)
    iron.box(0.04, 3.0, 0.04, tx + 1.62, 3.9, tz + 0.15).box(0.04, 3.0, 0.04, tx + 1.62, 3.9, tz + 0.65)
    const tankWood = keep(streetMat({ color: '#6a4a36', roughness: 0.95, aoBase: 0.6 }))
    const tankIron = keep(streetMat({ color: '#1d1d21', roughness: 0.5, metalness: 0.7, aoBase: 0.6 }))
    const woodGeo = keep(wood.build())
    const ironGeo = keep(iron.build())

    // vents, chillers, skylights, chimneys, antennas, cables
    const metal = new GeoBuilder()
    const rubber = new GeoBuilder()
    const chill = new GeoBuilder()
    const bricks = new GeoBuilder()
    const glass = new GeoBuilder()
    const r = rng(612)
    const ventSpots: [number, number][] = [[-2, -8], [3, -12], [7, 2], [13, -16], [-6, -18], [11, 6]]
    for (const [x, z] of ventSpots) {
      metal.cyl(0.26, 0.28, 1.15, x, 0.6, z, 12)
      metal.add(new THREE.ConeGeometry(0.46, 0.3, 12), x, 1.4, z)
      rubber.cyl(0.4, 0.4, 0.08, x, 0.04, z, 12)
    }
    for (const [x, z, w] of [[2, 6, 2.4], [-5, -5, 2.0], [14, -1, 2.6]] as const) {
      chill.box(w, 1.4, 1.3, x, 0.7, z)
      metal.box(w * 0.9, 0.06, 1.2, x, 1.43, z)
    }
    bricks.box(0.95, 4.2, 0.95, -1.5, 2.1, -16.5).box(0.95, 3.4, 0.95, 14.5, 1.7, -19)
    glass.box(3.0, 0.5, 2.0, 5.5, 0.3, -17.5)
    glass.box(2.2, 0.45, 1.6, -3.5, 0.27, -2.5)
    // antenna masts + dipoles
    const masts: [number, number, number][] = [[6, -19, 11], [-8.5, -21, 9], [13.2, -21, 13]]
    for (const [x, z, h] of masts) {
      metal.cyl(0.04, 0.06, h, x, h / 2, z, 6)
      for (let y = 3; y < h - 1; y += 2.2) metal.box(1.6 - y * 0.05, 0.03, 0.03, x, y, z)
    }
    // pallet + chair + cooler (someone hangs out here)
    const wood2 = new GeoBuilder()
    wood2.box(1.1, 0.12, 1.1, 8.2, 0.08, -18.4).box(0.5, 0.35, 0.4, 7.6, 0.3, -17.2)
    metal.box(0.45, 0.04, 0.45, 9.1, 0.45, -17.6).box(0.45, 0.5, 0.04, 9.1, 0.72, -17.82)
    for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) metal.cyl(0.015, 0.015, 0.45, 9.1 + dx, 0.22, -17.6 + dz, 4)
    const mk = (b: GeoBuilder, p: THREE.MeshStandardMaterialParameters) => ({ geo: keep(b.build()), mat: keep(streetMat({ aoBase: 0.55, ...p })) })
    const parts = [
      mk(metal, { color: '#3a3b40', roughness: 0.5, metalness: 0.6 }),
      mk(rubber, { color: '#18181a', roughness: 0.9 }),
      mk(chill, { color: '#a8a9a3', roughness: 0.6, metalness: 0.3 }),
      mk(bricks, { map: A.brick.red.map, color: '#c9aa9a', roughness: 0.95 }),
      mk(wood2, { color: '#7a5a3a', roughness: 0.95 }),
    ]
    const glassMat = keep(new THREE.MeshStandardMaterial({ color: '#0e1624', emissive: new THREE.Color('#5a90ff'), emissiveIntensity: 0.2, roughness: 0.15, metalness: 0.4 }))
    const glassGeo = keep(glass.build())

    // neighbouring rooftops below + tall neighbour on the left
    const nb = new GeoBuilder()
    const nbDecor = new GeoBuilder()
    const boxes: { x: number; z: number; w: number; d: number; top: number }[] = []
    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 4)
      const z = -32 - row * 20 - r.range(0, 6)
      const x = -34 + (i % 4) * 24 + r.range(-4, 4)
      const w = r.range(14, 22), d = r.range(12, 20)
      const top = -3.2 - row * 1.5 - r.range(0, 6)
      boxes.push({ x, z, w, d, top })
      const g = new THREE.BoxGeometry(w, 40, d)
      nb.add(g, x, top - 20, z)
      nbDecor.box(1.6, 0.9, 1.6, x + r.range(-w / 3, w / 3), top + 0.45, z + r.range(-d / 3, d / 3))
      nbDecor.cyl(0.7, 0.7, 1.5, x + r.range(-w / 3, w / 3), top + 0.75, z + r.range(-d / 3, d / 3), 10)
    }
    const nbGeo = keep(nb.build())
    const nbMat = keep(streetMat({ map: A.brick.weathered.map, color: '#8d7f78', roughness: 1, aoBase: 0.7 }))
    const nbDecGeo = keep(nbDecor.build())
    const nbDecMat = keep(streetMat({ color: '#3c3b3f', roughness: 0.8 }))
    const tallGeo = keep(new THREE.BoxGeometry(14, 30, 46))
    worldUV(tallGeo, 13.6, -17.2, 5, -8)
    A.tower.map.repeat.set(1, 1)
    const tallMat = keep(new THREE.MeshStandardMaterial({ map: A.tower.map, emissiveMap: A.tower.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.5, roughness: 0.8 }))

    // tower field — one merged mesh with world-scaled UVs so windows keep their size
    const field = new GeoBuilder()
    const fr = rng(909)
    for (let i = 0; i < 52; i++) {
      const dz = fr.range(120, 340)
      const w = fr.range(16, 34), d = fr.range(16, 28)
      const h = fr.range(22, 52) + (dz - 120) * fr.range(0.12, 0.3)
      const x = fr.range(-dz * 0.9, dz * 0.9)
      const z = -dz
      if (Math.abs(x) < 20 && dz < 190) continue
      const g = new THREE.BoxGeometry(w, h, d)
      worldUV(g, 13.6, x, h / 2 - 14, z)
      field.add(g, x, h / 2 - 14, z)
      if (h > 55 && fr() < 0.6) {
        const t = new THREE.BoxGeometry(w * 0.5, 14, d * 0.5)
        worldUV(t, 13.6, x, h - 14 + 7, z)
        field.add(t, x, h - 14 + 7, z)
      }
    }
    const fieldGeo = keep(field.build())
    const fieldMat = keep(new THREE.MeshStandardMaterial({ map: A.tower.map, emissiveMap: A.tower.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.5, roughness: 0.85 }))

    // front parapet graffiti
    const decal = keep(new THREE.PlaneGeometry(1, 1))
    const dm = (t: THREE.Texture) => keep(streetMat({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))
    const decals = [
      { m: dm(A.roofPieces[1]), p: [-1.5, 0.55, ROOF.z1 + 0.01] as [number, number, number], s: [3.2, 1.0], ry: 0 },
      { m: dm(A.roofPieces[2]), p: [5.5, 0.55, ROOF.z1 + 0.01] as [number, number, number], s: [3.4, 1.0], ry: 0 },
      { m: dm(A.roofPieces[3]), p: [12.2, 0.55, ROOF.z1 + 0.01] as [number, number, number], s: [2.8, 0.9], ry: 0 },
      { m: dm(A.roofPieces[0]), p: [-6, 2.0, ROOF.z0 - 7.98 + 4.0 + 0.02] as [number, number, number], s: [4.4, 2.3], ry: 0 },
      { m: dm(A.pieces[0]), p: [ROOF.x1 - 0.01, 0.55, -8] as [number, number, number], s: [3.6, 1.0], ry: -Math.PI / 2 },
    ]

    const doorMat = keep(new THREE.MeshStandardMaterial({ map: A.doors[1], roughness: 0.6, metalness: 0.5 }))
    const doorGeo = keep(new THREE.PlaneGeometry(1.15, 2.3))
    const lampGlow = keep(new THREE.SpriteMaterial({ map: A.glow, color: '#ffc27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }))
    const lampBulb = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.4, 2.4) }))
    const bulbGeo = keep(new THREE.SphereGeometry(0.08, 8, 6))

    return { disposables, deckGeo, deckMat, concrete, brick, parGeo, capGeo, capMat, bulk, woodGeo, ironGeo, tankWood, tankIron, parts, glassGeo, glassMat, nbGeo, nbMat, nbDecGeo, nbDecMat, tallGeo, tallMat, fieldGeo, fieldMat, decal, decals, doorMat, doorGeo, lampGlow, lampBulb, bulbGeo, boxes }
  }, [])

  useFrame(() => {
    const w = palette.windows
    kit.tallMat.emissiveIntensity = 0.1 + w * 0.95
    kit.fieldMat.emissiveIntensity = 0.08 + w * 1.0
    kit.glassMat.emissiveIntensity = 0.02 + w * 0.12
    const k = 0.4 + palette.lamps * 0.7
    kit.lampGlow.opacity = Math.min(1, k * 0.8)
    kit.lampBulb.color.setRGB(6 * k, 4.4 * k, 2.4 * k)
  }, -1)

  useEffect(() => () => kit.disposables.forEach((d) => d.dispose()), [kit])

  const stencilTank = A.stencils.seven
  return (
    <group position={[R, 0, 0]}>
      <mesh geometry={kit.deckGeo} material={kit.deckMat} rotation={[-Math.PI / 2, 0, 0]} position={[3, 0, -6]} />
      <mesh geometry={kit.parGeo} material={kit.brick} />
      <mesh geometry={kit.capGeo} material={kit.capMat} />
      {/* bulkhead */}
      <mesh geometry={kit.bulk} material={kit.brick} position={[-6, 1.8, 2]} />
      <mesh geometry={kit.doorGeo} material={kit.doorMat} position={[-3.46, 1.15, 2.5]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={kit.bulbGeo} material={kit.lampBulb} position={[-3.3, 2.75, 2.5]} />
      <sprite material={kit.lampGlow} position={[-3.3, 2.75, 2.5]} scale={[3.5, 3.5, 1]} />
      <pointLight position={[-2.6, 2.6, 2.5]} color="#ffb36b" intensity={14} distance={12} decay={2} />
      {/* tank */}
      <mesh geometry={kit.woodGeo} material={kit.tankWood} />
      <mesh geometry={kit.ironGeo} material={kit.tankIron} />
      <TankStencil tex={stencilTank} />
      {kit.parts.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} />
      ))}
      <mesh geometry={kit.glassGeo} material={kit.glassMat} />
      {kit.decals.map((d, i) => (
        <mesh key={i} geometry={kit.decal} material={d.m} position={d.p} rotation={[0, d.ry + Math.PI * (d.ry === 0 ? 0 : 0), 0]} scale={[d.s[0], d.s[1], 1]} renderOrder={2} />
      ))}
      {/* world around */}
      <mesh geometry={kit.nbGeo} material={kit.nbMat} />
      <mesh geometry={kit.nbDecGeo} material={kit.nbDecMat} />
      <mesh geometry={kit.tallGeo} material={kit.tallMat} position={[-17.2, 5, -8]} />
      <mesh geometry={kit.fieldGeo} material={kit.fieldMat} />
      <Festoon />
      <pointLight position={[6, 2.6, -21]} color="#8aa0ff" intensity={22} distance={16} decay={2} />
      <AntennaLights />
      <RoofGlyph />
      <Steam list={[{ x: R + 7, z: 2, y: 1.4 } as any, { x: R - 2, z: -8, y: 1.4 } as any]} size={0.8} />
    </group>
  )
}

/** The second way into DUALISMO: an iridescent glyph that is only quietly lit until found. */
function RoofGlyph() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uFound: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `
          varying vec2 vUv; uniform float uTime, uHover, uFound;
          void main(){
            vec2 p = (vUv - 0.5) * 2.0;
            float lobe = step(abs(p.x), abs(p.y) * 0.92) * step(abs(p.y), 0.78);
            float edge = smoothstep(0.0, 0.08, 0.78 - abs(p.y)) * smoothstep(0.0, 0.1, abs(p.y) * 0.92 - abs(p.x));
            float dotc = smoothstep(0.1, 0.0, length(p));
            vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + p.y * 0.6 + uTime * 0.12));
            float pulse = 0.55 + 0.45 * sin(uTime * 1.4);
            float a = (lobe * edge * (0.28 + 0.6 * uHover) + dotc * 0.8) * mix(pulse, 0.6, uFound);
            gl_FragColor = vec4(irid * a * 1.4, a);
          }`,
      }),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1.1, 1.1), [])
  const hov = useRef(0)
  const flag = useRef(false)
  useEffect(() => () => { mat.dispose(); geo.dispose() }, [mat, geo])
  useFrame((_, dt) => {
    hov.current += ((flag.current ? 1 : 0) - hov.current) * Math.min(1, dt * 6)
    mat.uniforms.uTime.value = rt.time
    mat.uniforms.uHover.value = hov.current
    mat.uniforms.uFound.value = useStore.getState().dualismoFound ? 1 : 0
  })
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[8.2, 0.62, ROOF.z1 + 0.04]}
      renderOrder={4}
      onPointerOver={(e) => { e.stopPropagation(); flag.current = true; useStore.getState().setCursor('portal', '?') }}
      onPointerOut={() => { flag.current = false; useStore.getState().setCursor('default') }}
      onClick={(e) => { e.stopPropagation(); enterDualism() }}
    />
  )
}

/** Stencilled "07" on the water tank (Easter egg). */
function TankStencil({ tex }: { tex: THREE.Texture }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, emissive: new THREE.Color('#ffe2b4'), emissiveMap: tex, emissiveIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [tex])
  const geo = useMemo(() => new THREE.PlaneGeometry(0.8, 0.8), [])
  const h = useRef(false)
  useEffect(() => () => { mat.dispose(); geo.dispose() }, [mat, geo])
  useFrame((_, dt) => { mat.emissiveIntensity += ((h.current ? 0.9 : 0.05) - mat.emissiveIntensity) * Math.min(1, dt * 8) })
  const t = alterco.tracks[6]
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[10, 3.9, -6 + 1.7]}
      renderOrder={3}
      onPointerOver={(e) => { e.stopPropagation(); h.current = true; useStore.getState().setCursor('link', '07'); useStore.getState().say(`${pad(t.n)} — ${t.title.toUpperCase()}`, 'The outro was waiting up here.') }}
      onPointerOut={() => { h.current = false; useStore.getState().setCursor('default') }}
    />
  )
}

/** String lights across the roof. */
function Festoon() {
  const kit = useMemo(() => {
    const a = new THREE.Vector3(-3.4, 3.3, -1.4)
    const b = new THREE.Vector3(8.5, 2.5, -6)
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.7, 0)))
    }
    const wire = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.01, 4)
    const wm = new THREE.MeshBasicMaterial({ color: '#050506' })
    const bulb = new THREE.SphereGeometry(0.07, 8, 6)
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 1.8) })
    const glow = new THREE.SpriteMaterial({ map: A.glow, color: '#ffbb70', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })
    return { pts: pts.slice(1, 10), wire, wm, bulb, bm, glow }
  }, [])
  useFrame(() => {
    const k = palette.lamps
    kit.bm.color.setRGB(5 * k, 3.6 * k, 1.8 * k)
    kit.glow.opacity = 0.7 * k
  }, -1)
  useEffect(() => () => { kit.wire.dispose(); kit.wm.dispose(); kit.bulb.dispose(); kit.bm.dispose(); kit.glow.dispose() }, [kit])
  return (
    <group>
      <mesh geometry={kit.wire} material={kit.wm} />
      {kit.pts.map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={kit.bulb} material={kit.bm} position={[0, -0.08, 0]} />
          <sprite material={kit.glow} position={[0, -0.08, 0]} scale={[0.9, 0.9, 1]} />
        </group>
      ))}
      <pointLight position={[2.5, 2.2, -3.6]} color="#ffb870" intensity={9} distance={11} decay={2} />
    </group>
  )
}

/** Seven aircraft-warning lights; once all seven tracks have been opened they turn white and chase. */
function AntennaLights() {
  const spots: [number, number, number][] = [[6, 11.1, -19], [-8.5, 9.1, -21], [13.2, 13.1, -21], [10, 6.55, -6], [-1.5, 4.3, -16.5], [14.5, 3.5, -19], [-6, 3.7, 2]]
  const mats = useMemo(() => spots.map(() => new THREE.SpriteMaterial({ map: A.glow, color: '#ff3a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })), [])
  useFrame(() => {
    const done = useStore.getState().visited.length === 7
    const t = rt.time
    mats.forEach((m, i) => {
      if (done) {
        m.color.set('#e8f2ff')
        const ph = (t * 1.2 - i * 0.22) % 3
        m.opacity = ph > 0 && ph < 0.35 ? 1 : 0.18
      } else {
        m.color.set('#ff3a2a')
        m.opacity = Math.sin(t * 2.2 + i * 1.3) > 0.82 ? 0.95 : 0.12
      }
    })
  })
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  return (
    <group>
      {spots.map((p, i) => (
        <sprite key={i} material={mats[i]} position={p} scale={[1.1, 1.1, 1]} />
      ))}
    </group>
  )
}

export function RooftopWorld() {
  return (
    <group>
      <RooftopEnvironment />
      <Backdrop origin={[R, 0, 0]} z={[-250, -340, -440]} blocks={false} />
      <AltercoArtwork mode="final" position={[R + 5.2, 5.2, -42]} size={7.2} />
    </group>
  )
}

export { CP }
