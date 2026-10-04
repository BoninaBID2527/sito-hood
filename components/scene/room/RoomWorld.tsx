'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { useWorldFrame } from '@/hooks/useWorldFrame'
import { ROOM_X, DOOR, MONITOR, room } from '@/lib/room'
import { RX } from '@/lib/roomTextures'
import { vid, videoTexture, videoMode } from '@/lib/roomVideo'
import { focusVideo, openLink, roomScene } from '@/lib/roomActions'
import { doorLeafTexture } from '@/lib/roomDoor'
import { makeCanvas, toTexture } from '@/lib/paint'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildRoomGeometry } from './build'
import { Vestibule } from './Vestibule'
import type { RoomLinkId } from '@/data/room'

/**
 * THE HOODDINO ROOM. Mounted (hidden) once the visitor approaches the street door; drawn and updated only while `rt.world === 'room'`.
 * Draw-call budget (high tier): ~24 — merged static geometry per material, three screens, three prints, one decal atlas.
 */

const PRINT = { portrait: { w: 0.96, h: 1.16 }, live: { w: 0.946, h: 1.14 } }

/** a flat photo with a slight paper bow (so it catches the light like a print, not a texture) */
function bowedPlane(w: number, h: number, bow: number) {
  const g = new THREE.PlaneGeometry(w, h, 8, 8)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2)
    p.setZ(i, bow * (1 - u * u) * (1 - 0.6 * v * v) + 0.012 * Math.max(0, u * v - 0.6))
  }
  g.computeVertexNormals()
  return g
}

/** convex CRT glass */
function crtGlass(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h, 10, 8)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2)
    p.setZ(i, 0.025 * (1 - 0.5 * (u * u + v * v)))
  }
  g.computeVertexNormals()
  return g
}

const crtVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const crtFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uTime, uInst, uBright;
float h11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
void main(){
  vec2 c = vUv*2.-1.;
  c *= 1.0 + 0.05*dot(c,c);
  vec2 uv = c*.5+.5;
  float row = floor(uv.y*70.);
  float jit = (h11(row + floor(uTime*9.)) - .5) * .012 * uInst;
  // a slow rolling tear (signal instability) — restrained: only a thin band, moderated by uInst
  float band = smoothstep(.04, .0, abs(fract(uv.y*.7 - uTime*.045) - .5)) * uInst;
  uv.x += jit + band*.018;
  float sp = .0022 + .0035*uInst;
  vec3 col = vec3(texture2D(uMap, uv + vec2(sp,0.)).r, texture2D(uMap, uv).g, texture2D(uMap, uv - vec2(sp,0.)).b);
  float scan = .84 + .16*sin(uv.y*260.);
  col *= scan;
  col += band*.12;
  float vig = smoothstep(1.15, .5, length(c));
  col *= vig * uBright;
  if (uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) col = vec3(0.);
  gl_FragColor = vec4(col, 1.);
}`

function makeKit(level: number) {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o })
  const apertureTex = (() => {
    const { canvas, ctx } = makeCanvas(4, 128)
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, '#5a6f96'); g.addColorStop(0.5, '#a8a6a0'); g.addColorStop(1, '#e8b27a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128)
    return toTexture(canvas, { mipmaps: false, aniso: 1 })
  })()
  const leafTex = doorLeafTexture()
  const mats = {
    walls: std({ map: RX.wall, roughness: 0.95 }),
    floor: std({ map: RX.floor, roughness: 0.62, metalness: 0.05 }),
    solid: std({ vertexColors: true, roughness: 0.78, metalness: 0.15 }),
    dark: new THREE.MeshBasicMaterial({ color: '#0a0a0b' }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    foam: std({ map: RX.foam, roughness: 1 }),
    fabricRed: std({ map: RX.fabricRed, roughness: 1 }),
    fabricSlate: std({ map: RX.fabricSlate, roughness: 1 }),
    wood: std({ map: RX.wood, roughness: 0.55 }),
    rug: std({ map: RX.fabricRed, roughness: 1, color: '#c9a7a0' }),
    daw: new THREE.MeshBasicMaterial({ map: RX.daw, toneMapped: false, color: new THREE.Color(0.78, 0.8, 0.85) }),
    screen: new THREE.MeshBasicMaterial({ map: RX.posterPlay ?? RX.poster, toneMapped: false, color: new THREE.Color(0.62, 0.62, 0.64) }),
    phone: new THREE.MeshBasicMaterial({ map: RX.phone, toneMapped: false, color: new THREE.Color(0.7, 0.7, 0.75) }),
    keys: std({ map: RX.keys, roughness: 0.5 }),
    cover: std({ map: A.covers.alterco, roughness: 0.4, emissive: '#ffffff', emissiveMap: A.covers.alterco, emissiveIntensity: 0.4 }),
    aperture: new THREE.MeshBasicMaterial({ map: apertureTex, fog: false, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(1.3, 1.3, 1.4) }),
    leaf: std({ map: leafTex, roughness: 0.55 }),
    shadow: new THREE.MeshBasicMaterial({ map: RX.blob, color: '#000', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  }
  const crt = level >= 1
    ? new THREE.ShaderMaterial({ vertexShader: crtVert, fragmentShader: crtFrag, uniforms: { uMap: { value: RX.signal }, uTime: { value: 0 }, uInst: { value: 0.35 }, uBright: { value: 1.25 } }, toneMapped: false })
    : new THREE.MeshBasicMaterial({ map: RX.signal, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) })
  const disposables: { dispose(): void }[] = [apertureTex, leafTex, crt, ...Object.values(mats)]
  return { mats, crt, disposables }
}

type RoomKit = ReturnType<typeof makeKit>

export function RoomWorld({ detail }: { detail: boolean }) {
  const level = rt.quality.level
  const geo = useMemo(() => buildRoomGeometry(level), [level])
  const kit = useMemo(() => makeKit(level), [level])
  useEffect(() => () => kit.disposables.forEach((d) => d.dispose()), [kit])
  useEffect(() => () => { Object.values(geo).forEach((g) => g && g.dispose()) }, [geo])

  // the high-detail photo tier replaces the low-cost one once it has arrived
  const portrait = (detail && RX.portraitHi) || RX.portrait
  const live = (detail && RX.liveHi) || RX.live
  const signal = (detail && RX.signalHi) || RX.signal
  const photoMats = useMemo(() => ({
    portrait: new THREE.MeshStandardMaterial({ map: portrait, roughness: 0.5, emissive: '#ffffff', emissiveMap: portrait, emissiveIntensity: 0.32 }),
    live: new THREE.MeshStandardMaterial({ map: live, roughness: 0.5, emissive: '#ffffff', emissiveMap: live, emissiveIntensity: 0.32 }),
  }), [portrait, live])
  useEffect(() => () => { photoMats.portrait.dispose(); photoMats.live.dispose() }, [photoMats])
  useEffect(() => {
    if (kit.crt instanceof THREE.ShaderMaterial) kit.crt.uniforms.uMap.value = signal
    else { kit.crt.map = signal; kit.crt.needsUpdate = true }
  }, [kit, signal])

  const portraitGeo = useMemo(() => bowedPlane(PRINT.portrait.w, PRINT.portrait.h, 0.012), [])
  const liveGeo = useMemo(() => bowedPlane(PRINT.live.w, PRINT.live.h, 0.01), [])
  const glassGeo = useMemo(() => crtGlass(0.34, 0.27), [])
  useEffect(() => () => { portraitGeo.dispose(); liveGeo.dispose(); glassGeo.dispose() }, [portraitGeo, liveGeo, glassGeo])

  // contact shadows under everything pasted / hung on a wall (one merged, multiplied layer)
  const shadows = useMemo(() => {
    const items: { x: number; y: number; z: number; ry: number; w: number; h: number }[] = [
      { x: 3.19, y: 1.17, z: -5.45, ry: -Math.PI / 2, w: 1.38, h: 1.6 },
      { x: 3.19, y: 1.17, z: -3.45, ry: -Math.PI / 2, w: 2.0, h: 1.55 },
      { x: -3.19, y: 1.25, z: -3.2, ry: Math.PI / 2, w: 1.3, h: 1.5 },
      { x: -3.19, y: 0.85, z: -4.55, ry: Math.PI / 2, w: 1.15, h: 0.85 },
      { x: -3.19, y: 1.48, z: -6.4, ry: Math.PI / 2, w: 1.0, h: 1.0 },
    ]
    return mergeParts(items.map((it) => {
      const g = new THREE.PlaneGeometry(it.w, it.h)
      g.rotateY(it.ry)
      g.translate(it.x, it.y, it.z)
      return g
    }))
  }, [])
  useEffect(() => () => shadows.dispose(), [shadows])

  return (
    <group position={[ROOM_X, 0, DOOR.z]} rotation={[0, Math.PI / 2, 0]}>
      <RoomSurfaces geo={geo} kit={kit} />
      <Vestibule />
      <Aperture kit={kit} />
      <Workstation kit={kit} />
      <mesh geometry={shadows} material={kit.mats.shadow} renderOrder={1} />
      <Prints geoP={portraitGeo} geoL={liveGeo} mats={photoMats} kit={kit} detail={detail} />
      <Crt kit={kit} glass={glassGeo} />
      {detail && <Paste />}
      <Lighting />
      <Interactions />
      <Warm />
    </group>
  )
}

function RoomSurfaces({ geo, kit }: { geo: ReturnType<typeof buildRoomGeometry>; kit: RoomKit }) {
  const m = kit.mats
  return (
    <>
      <mesh geometry={geo.walls} material={m.walls} />
      <mesh geometry={geo.floor} material={m.floor} />
      <mesh geometry={geo.solid} material={m.solid} />
      {geo.dark && <mesh geometry={geo.dark} material={m.dark} />}
      <mesh geometry={geo.glow} material={m.glow} />
      <mesh geometry={geo.foam} material={m.foam} />
      <mesh geometry={geo.fabricRed} material={m.fabricRed} />
      <mesh geometry={geo.fabricSlate} material={m.fabricSlate} />
      <mesh geometry={geo.wood} material={m.wood} />
      {geo.rug && <mesh geometry={geo.rug} material={m.rug} />}
    </>
  )
}

/** the doorway seen from inside: an open padded leaf and the dusk light of the alley leaking in */
function Aperture({ kit }: { kit: RoomKit }) {
  return (
    <group>
      <mesh material={kit.mats.aperture} position={[0, DOOR.h / 2, 0.03]}>
        <planeGeometry args={[DOOR.w, DOOR.h]} />
      </mesh>
      <group position={[-DOOR.w / 2, 0, 0.02]} rotation={[0, 1.72, 0]}>
        <mesh material={kit.mats.leaf} position={[DOOR.w / 2, DOOR.h / 2, 0]}>
          <boxGeometry args={[DOOR.w - 0.02, DOOR.h - 0.02, 0.07]} />
        </mesh>
      </group>
    </group>
  )
}

/** the hero: the desk, the two monitors, the keyboard, the phone */
function Workstation({ kit }: { kit: RoomKit }) {
  const screen = useRef<THREE.Mesh>(null)
  const state = useRef({ live: false, hover: 0, tex: null as THREE.Texture | null })
  const phoneMat = kit.mats.phone as THREE.MeshBasicMaterial
  useWorldFrame('room', () => {
    const s = state.current
    const mat = kit.mats.screen as THREE.MeshBasicMaterial
    const wantLive = vid.live && videoMode() === 'texture' && !!vid.el && vid.el.readyState >= 2
    if (wantLive !== s.live) {
      s.live = wantLive
      const t = wantLive ? videoTexture() : null
      mat.map = t ?? RX.posterPlay ?? RX.poster
      mat.needsUpdate = true
    }
    // idle: a dim, low-cost poster; the focused monitor lights the room instead
    const k = s.live ? 1 : 0.62 + 0.2 * hover.video
    const b = 0.62 + (1 - 0.62) * room.push
    mat.color.setScalar(s.live ? 1.0 : Math.max(k, b * 0.7))
    phoneMat.color.setScalar(0.7 + 0.5 * hover.tiktok)
  }, 0)
  return (
    <group>
      {/* the keyboard's playing surface */}
      <mesh position={[0, 0.8, -7.92]} rotation={[-Math.PI / 2 - 0.06, 0, 0]} material={kit.mats.keys}>
        <planeGeometry args={[0.98, 0.265]} />
      </mesh>
      {/* secondary (landscape) monitor: an abstract arrangement view — not readable, nothing invented */}
      <mesh position={[-0.52, 1.14, -8.275]} material={kit.mats.daw}>
        <planeGeometry args={[0.6, 0.34]} />
      </mesh>
      {/* HERO: the vertical studio monitor — poster outside PLAY, the real video when focused */}
      <mesh ref={screen} position={[MONITOR.x, MONITOR.y, -8.265]} material={kit.mats.screen}>
        <planeGeometry args={[MONITOR.w, MONITOR.h]} />
      </mesh>
      {/* the phone on the desk (TikTok) */}
      <mesh position={[1.18, 0.862, -7.985]} rotation={[-0.3, 0.3, 0]} material={phoneMat}>
        <planeGeometry args={[0.068, 0.14]} />
      </mesh>
    </group>
  )
}

/** hover states shared between the hit areas (read every frame by the things that react; written by pointer events) */
const hover = { video: 0, spotify: 0, tiktok: 0, instagram: 0, crt: 0, active: '' as '' | 'video' | 'spotify' | 'tiktok' | 'instagram' | 'crt' }

function Prints({ geoP, geoL, mats, kit, detail }: { geoP: THREE.BufferGeometry; geoL: THREE.BufferGeometry; mats: { portrait: THREE.Material; live: THREE.Material }; kit: RoomKit; detail: boolean }) {
  const card = useRef<THREE.Mesh>(null)
  const cardMat = useMemo(() => (detail && RX.liveCard ? new THREE.MeshStandardMaterial({ map: RX.liveCard, alphaTest: 0.35, roughness: 0.8, emissive: '#ffffff', emissiveMap: RX.liveCard, emissiveIntensity: 0.3 }) : null), [detail])
  const headMat = useMemo(() => (detail && RX.headline ? new THREE.MeshBasicMaterial({ map: RX.headline, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85) }) : null), [detail])
  const metaMat = useMemo(() => (detail && RX.meta ? new THREE.MeshBasicMaterial({ map: RX.meta, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(0.8, 0.8, 0.8) }) : null), [detail])
  const paraMat = useMemo(() => (detail && RX.paragraph ? new THREE.MeshStandardMaterial({ map: RX.paragraph, alphaTest: 0.35, roughness: 0.85, emissive: '#ffffff', emissiveMap: RX.paragraph, emissiveIntensity: 0.3 }) : null), [detail])
  useEffect(() => () => { cardMat?.dispose(); headMat?.dispose(); metaMat?.dispose(); paraMat?.dispose() }, [cardMat, headMat, metaMat, paraMat])
  useWorldFrame('room', () => {
    if (cardMat) cardMat.color.setScalar(1 + 0.2 * hover.instagram)
  }, 0)
  return (
    <group>
      {/* WHO IS HOODDINO? — right wall (faces −x): portrait print, the exact biography, the painted headline and stencilled meta */}
      <mesh geometry={geoP} material={mats.portrait} position={[3.146, 1.17, -5.45]} rotation={[0, -Math.PI / 2, 0]} />
      {paraMat && <mesh material={paraMat} position={[3.17, 1.17, -3.45]} rotation={[0, -Math.PI / 2, 0.012]}><planeGeometry args={[1.8, 1.35]} /></mesh>}
      {headMat && <mesh material={headMat} position={[3.19, 2.3, -4.45]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[2.0, 0.833]} /></mesh>}
      {metaMat && <mesh material={metaMat} position={[3.19, 0.25, -4.45]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[2.6, 0.433]} /></mesh>}
      {/* LIVE — left wall (faces +x): the documentary print and the card that points to Instagram for dates */}
      <mesh geometry={geoL} material={mats.live} position={[-3.15, 1.25, -3.2]} rotation={[0, Math.PI / 2, 0]} />
      {cardMat && <mesh ref={card} material={cardMat} position={[-3.15, 0.85, -4.55]} rotation={[0, Math.PI / 2, -0.035]}><planeGeometry args={[0.9, 0.6]} /></mesh>}
      {/* ALTERCO — the official artwork, untouched, as a framed print above the sofa */}
      <mesh material={kit.mats.cover} position={[-3.145, 1.48, -6.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.62, 0.62]} />
      </mesh>
    </group>
  )
}

function Crt({ kit, glass }: { kit: RoomKit; glass: THREE.BufferGeometry }) {
  useWorldFrame('room', () => {
    const m = kit.crt
    if (!(m instanceof THREE.ShaderMaterial)) return
    const reduced = rt.reducedMotion
    m.uniforms.uTime.value = reduced ? 0 : rt.time
    // restrained by default; a touch more when the pointer wakes it
    const target = reduced ? 0 : 0.28 + 0.5 * hover.crt
    m.uniforms.uInst.value += (target - m.uniforms.uInst.value) * 0.12
  }, 0)
  return <mesh geometry={glass} material={kit.crt} position={[-2.239, 0.87, -7.879]} rotation={[0, 0.5, 0]} />
}

/** wall dressing: one atlas, one merged mesh (skipped on the mobile tier's secondary decals) */
function Paste() {
  const level = rt.quality.level
  const built = useMemo(() => {
    if (!RX.atlas || !RX.cells) return null
    type Side = 'R' | 'L' | 'B' | 'F'
    // [cell, wall, along-wall coordinate, y, width, roll, secondary?]
    const list: [string, Side, number, number, number, number, boolean?][] = [
      ['fld_red', 'R', -5.45, 1.17, 1.5, 0.03],
      ['fld_blue', 'R', -3.45, 1.17, 2.25, -0.015],
      ['tape', 'R', -5.95, 1.78, 0.2, 0.7], ['tape', 'R', -4.95, 1.78, 0.2, -0.6], ['tape', 'R', -5.95, 0.56, 0.2, -0.7], ['tape', 'R', -4.95, 0.56, 0.2, 0.6],
      ['tape', 'R', -4.5, 1.85, 0.22, 0.2], ['tape', 'R', -2.45, 1.85, 0.22, -0.3], ['tape', 'R', -4.5, 0.5, 0.22, -0.2], ['tape', 'R', -2.45, 0.5, 0.22, 0.25],
      ['hand_hd', 'R', -6.75, 0.95, 0.5, 0.1, true], ['st_eye', 'R', -2.0, 1.75, 0.3, 0, true], ['stk_a', 'R', -6.35, 1.62, 0.16, 0.2, true], ['stk_b', 'R', -2.0, 0.85, 0.16, -0.3, true],
      ['st_alterco', 'R', -7.2, 0.3, 0.9, 0.02, true], ['blk_hd', 'R', -7.35, 1.95, 1.0, 0.02, true],
      ['fld_dark', 'L', -3.2, 1.25, 1.5, 0.02],
      ['paper_a', 'L', -2.55, 1.55, 0.62, 0.05], ['paper_c', 'L', -3.95, 1.6, 0.5, -0.04, true],
      ['tape', 'L', -2.75, 1.82, 0.2, 0.5], ['tape', 'L', -3.62, 1.82, 0.2, -0.6], ['tape', 'L', -2.75, 0.7, 0.2, -0.5], ['tape', 'L', -3.62, 0.7, 0.2, 0.5],
      ['tape', 'L', -4.2, 1.17, 0.2, 0.4], ['tape', 'L', -4.95, 1.17, 0.2, -0.3],
      ['blk_hd', 'L', -5.15, 2.15, 1.25, -0.02, true], ['hand_2005', 'L', -2.1, 0.55, 0.5, -0.07, true], ['stk_c', 'L', -1.95, 1.95, 0.16, 0.1, true], ['stk_d', 'L', -4.8, 0.3, 0.16, -0.2, true],
      ['st_cross', 'B', 2.85, 1.4, 0.3, 0, true], ['fld_ochre', 'B', 2.4, 1.0, 1.1, 0.02, true], ['st_barcode', 'B', -2.95, 2.4, 0.26, 0.1, true],
      ['paper_b', 'F', 1.0, 1.2, 0.5, 0.05, true], ['st_arrow', 'F', -1.5, 1.2, 0.4, 0.0], ['stk_a', 'F', -2.2, 0.8, 0.16, 0.2, true],
    ]
    const cells = RX.cells!
    const parts: THREE.BufferGeometry[] = []
    for (const [id, side, a, y, w, roll, secondary] of list) {
      const cell = cells[id]
      if (!cell || (secondary && level === 0)) continue
      const g = new THREE.PlaneGeometry(w, w / cell.aspect)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, cell.uv[0] + uv.getX(i) * cell.uv[2], cell.uv[1] + uv.getY(i) * cell.uv[3])
      g.rotateZ(roll)
      const e = 0.005
      if (side === 'R') { g.rotateY(-Math.PI / 2); g.translate(3.2 - e, y, a) }
      else if (side === 'L') { g.rotateY(Math.PI / 2); g.translate(-3.2 + e, y, a) }
      else if (side === 'B') { g.translate(a, y, -8.6 + e) }
      else { g.rotateY(Math.PI); g.translate(a, y, -1.25 - e) }
      parts.push(g)
    }
    const merged = mergeParts(parts)
    const mat = new THREE.MeshStandardMaterial({ map: RX.atlas, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    return { merged, mat }
  }, [level])
  useEffect(() => () => { built?.merged.dispose(); built?.mat.dispose() }, [built])
  if (!built) return null
  return <mesh geometry={built.merged} material={built.mat} renderOrder={2} />
}

function mergeParts(parts: THREE.BufferGeometry[]) {
  const m = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return m
}

/** motivated lights only: the desk lamp, a cold LED fill from the back wall, a red accent by the door */
function Lighting() {
  const lamp = useRef<THREE.PointLight>(null)
  const blue = useRef<THREE.PointLight>(null)
  const red = useRef<THREE.PointLight>(null)
  const wash = useRef<THREE.PointLight>(null)
  const level = rt.quality.level
  useWorldFrame('room', () => {
    const d = 1 - 0.55 * room.dim
    if (lamp.current) lamp.current.intensity = 2.4 * (1 - 0.35 * room.dim)
    if (blue.current) blue.current.intensity = 3.0 * d
    if (red.current) red.current.intensity = 2.1 * d
    if (wash.current) wash.current.intensity = 6 * d
  }, 0)
  return (
    <>
      {level >= 1 && <pointLight ref={wash} position={[0.2, 2.55, -4.3]} color="#cfe0ff" intensity={6} distance={8} decay={2} />}
      <pointLight ref={lamp} position={[-0.72, 1.28, -8.0]} color="#ffb070" intensity={2.4} distance={4.2} decay={2} />
      {level >= 1 && <pointLight ref={blue} position={[-1.8, 2.5, -7.6]} color="#3f6dff" intensity={3} distance={6} decay={2} />}
      {level >= 2 && <pointLight ref={red} position={[2.3, 2.3, -2.9]} color="#ff3a2a" intensity={2.1} distance={4.5} decay={2} />}
    </>
  )
}

const inRoom = () => useStore.getState().mode === 'room' && rt.world === 'room'

function Hit({ id, pos, size, label, cursor = 'link', onClick, rotY = 0 }: {
  id: keyof typeof hover & string
  pos: [number, number, number]
  size: [number, number, number]
  label?: string
  cursor?: 'link' | 'explore'
  onClick?: () => void
  rotY?: number
}) {
  return (
    <mesh
      position={pos}
      rotation={[0, rotY, 0]}
      onPointerOver={(e) => {
        if (!inRoom()) return
        e.stopPropagation()
        hover.active = id as typeof hover.active
        useStore.getState().setCursor(cursor, label)
      }}
      onPointerOut={() => {
        if (hover.active === id) hover.active = ''
        const c = useStore.getState().cursor
        if (c.label === label) useStore.getState().setCursor('default')
      }}
      onClick={(e) => {
        if (!inRoom() || !onClick) return
        e.stopPropagation()
        onClick()
      }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

function Interactions() {
  // hover → smoothed 0..1 (one cheap frame callback, room only)
  useWorldFrame('room', (_s, dt) => {
    const k = 1 - Math.exp(-10 * dt)
    for (const key of ['video', 'spotify', 'tiktok', 'instagram', 'crt'] as const) {
      hover[key] += ((hover.active === key ? 1 : 0) - hover[key]) * k
    }
  }, -0.5)
  const focused = () => room.pushT > 0.5
  const link = (id: RoomLinkId) => () => openLink(id)
  return (
    <group>
      <Hit id="video" pos={[MONITOR.x, MONITOR.y, -8.15]} size={[0.62, 0.95, 0.3]} label={focused() ? undefined : 'PLAY'} onClick={() => { if (!focused()) focusVideo() }} />
      <Hit id="spotify" pos={[1.85, 1.02, -8.0]} size={[0.5, 0.7, 0.5]} label="SPOTIFY ↗" onClick={link('spotify')} />
      <Hit id="tiktok" pos={[1.18, 0.86, -7.98]} size={[0.3, 0.3, 0.3]} label="TIKTOK ↗" onClick={link('tiktok')} />
      <Hit id="instagram" pos={[-3.0, 0.88, -4.55]} size={[0.5, 0.9, 1.1]} label="INSTAGRAM ↗" onClick={link('instagram')} />
      <Hit id="crt" pos={[-2.3, 0.86, -7.95]} size={[0.6, 0.6, 0.6]} cursor="explore" />
    </group>
  )
}

/**
 * one-off, while the visitor walks up to the door: the room's textures are uploaded to the GPU off-screen.
 * (Programs are NOT precompiled: three keys a program on the lights that are visible, and with the street on screen that would be
 * the wrong variant for ~150 street programs. The first room frame compiles the right ones, behind the black of the airlock dip.)
 */
function Warm() {
  const gl = useThree((s) => s.gl)
  const done = useRef(false)
  useEffect(() => {
    roomScene.mounted = true
    return () => { roomScene.mounted = false }
  }, [])
  useFrame(() => {
    if (!room.warm || done.current) return
    done.current = true
    for (const t of [RX.wall, RX.floor, RX.foam, RX.fabricRed, RX.fabricSlate, RX.wood, RX.keys, RX.daw, RX.portrait, RX.live, RX.signal, RX.poster, RX.posterPlay]) {
      try { if (t) gl.initTexture(t) } catch { /* uploaded on first use instead */ }
    }
  })
  return null
}
