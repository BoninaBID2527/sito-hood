'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { useWorldFrame } from '@/hooks/useWorldFrame'
import { ROOM_X, DOOR, MONITOR, L, room } from '@/lib/room'
import { RX } from '@/lib/roomTextures'
import { vid, videoTexture, videoMode } from '@/lib/roomVideo'
import { focusVideo, openLink, roomScene } from '@/lib/roomActions'
import { doorLeafTexture } from '@/lib/roomDoor'
import { makeCanvas, toTexture } from '@/lib/paint'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildRoomGeometry, type RoomGeo } from './build'
import { PLACE, RED_LAMP } from './furniture'
import { Vestibule } from './Vestibule'
import type { RoomLinkId } from '@/data/room'

/**
 * THE HOODDINO ROOM. Mounted (hidden) once the visitor approaches the street door; drawn and updated only while `rt.world === 'room'`.
 * Draw-call budget: one merged mesh per material (walls, floor, matte, satin, metal, wood, fabric, foam, glow, rug), the displays, the
 * pictures and one decal atlas. Contact / occlusion is baked (see build.ts) — no shadow maps.
 */

// Loaded with the ROOM chunk; shared LTC textures are renderer-wide, never rebuilt per visit.
RectAreaLightUniformsLib.init()

const PRINT = { portrait: { w: 0.96, h: 1.16 }, live: { w: 0.946, h: 1.14 }, art: 0.62 }

/** a flat photo with an optional slight paper bow (a taped print buckles; a framed one does not) */
function bowedPlane(w: number, h: number, bow: number) {
  const g = new THREE.PlaneGeometry(w, h, bow > 0 ? 8 : 1, bow > 0 ? 8 : 1)
  if (bow <= 0) return g
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
    p.setZ(i, 0.012 * (1 - 0.5 * (u * u + v * v)))
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

/**
 * A physical display: the picture is fitted into the panel with its exact aspect (black LCD bars where it does not fill it), and the glass
 * in front of it reflects a dim version of the room (Fresnel-weighted): the warm doorway behind the viewer, the ceiling tubes, a soft
 * smudge. Room-local +z (the door side) is world +x.
 */
const dispVert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const dispFrag = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
uniform sampler2D uMap;
uniform vec2 uFit;
uniform float uBright, uGlass, uDim, uVideo;
void main(){
  vec2 uv = (vUv - .5) * uFit + .5;
  vec3 col = texture2D(uMap, uv).rgb;
  // VideoTexture uses RGBA8; supplied still images are already decoded by their sRGB texture format.
  if (uVideo > .5) col = mix(col / 12.92, pow((col + .055) / 1.055, vec3(2.4)), step(vec3(.04045), col));
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) col = vec3(.010, .011, .013); // the bars: a lit-but-black LCD
  col *= uBright;
  vec3 N = normalize(vN), V = normalize(vV);
  vec3 R = reflect(V, N);
  float f = .045 + .955 * pow(1. - clamp(dot(-V, N), 0., 1.), 5.);
  // what the glass sees: dark room, warm doorway, ceiling tubes, a faint cool bounce from the left wall
  vec3 e = vec3(.018, .019, .024);
  e += vec3(1., .58, .3) * .55 * smoothstep(.45, .95, R.x) * smoothstep(-.1, .35, R.y);
  e += vec3(.75, .85, 1.) * 1.6 * smoothstep(.07, .0, abs(R.z - .02)) * smoothstep(.3, .7, R.y);
  e += vec3(.25, .3, .42) * .5 * smoothstep(.0, 1., -R.z) * smoothstep(.5, -.2, R.y) * .6;
  col += e * (f + .035) * uGlass * uDim;
  gl_FragColor = vec4(col, 1.);
}`

function makeDisplay(map: THREE.Texture, screenAspect: number, contentAspect: number, bright: number) {
  const r = contentAspect / screenAspect
  const fit = r >= 1 ? new THREE.Vector2(1, r) : new THREE.Vector2(1 / r, 1)
  return new THREE.ShaderMaterial({ vertexShader: dispVert, fragmentShader: dispFrag, uniforms: { uMap: { value: map }, uVideo: { value: 0 }, uFit: { value: fit }, uBright: { value: bright }, uGlass: { value: 1 }, uDim: { value: 1 } }, toneMapped: false })
}

/** floor material: boards + the baked multiply map (contact shadows and corner occlusion) — sampled with the floor's own position, no second UV set */
function bakedMaterial(bake: THREE.Texture, params: THREE.MeshStandardMaterialParameters, key: string) {
  const m = new THREE.MeshStandardMaterial(params)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBake = { value: bake }
    sh.uniforms.uBakeO = { value: new THREE.Vector2(L.x0, L.zb) }
    sh.uniforms.uBakeS = { value: new THREE.Vector2(1 / (L.x1 - L.x0), 1 / (L.zf - L.zb)) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBake; uniform vec2 uBakeO; uniform vec2 uBakeS;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = (position.xz - uBakeO) * uBakeS;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBake; uniform sampler2D uBake;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(uBake, vBake).rgb * 2.0;')
  }
  m.customProgramCacheKey = () => key
  return m
}


/** Low-frequency room irradiance from installed sources, evaluated separately from albedo.
 * The monitor lobe is directed into the room; warm desk/door bounce and neutral ceiling
 * fill remain local. Existing contact bakes retain occlusion. No realtime GI or extra pass. */
function roomIrradiance(m: THREE.MeshStandardMaterial, strength = 1) {
  const prior = m.onBeforeCompile.bind(m)
  m.onBeforeCompile = (sh, renderer) => {
    prior(sh, renderer)
    sh.uniforms.uRoomBounce = { value: strength }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 roomBake; varying vec3 vRoomPosition; varying vec3 vRoomBake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoomPosition = position; vRoomBake = roomBake;')
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRoomPosition; varying vec3 vRoomBake; uniform float uRoomBounce;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + .045*sin(vRoomPosition.x*2.1 + vRoomPosition.z*.8), .18, 1.);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        vec3 rp = vRoomPosition;
        vec3 wn = inverseTransformDirection(normal, viewMatrix);
        vec3 rn = vec3(-wn.z, wn.y, wn.x);
        float deskPool = exp(-dot((rp-vec3(-.8,1.,-8.15))*vec3(.65,.8,.7), (rp-vec3(-.8,1.,-8.15))*vec3(.65,.8,.7)));
        float screenPool = exp(-dot((rp-vec3(.4,1.15,-8.05))*vec3(.8,1.,.7), (rp-vec3(.4,1.15,-8.05))*vec3(.8,1.,.7)));
        float doorwayPool = exp(-dot((rp-vec3(0.,1.,-1.4))*vec3(.45,.5,.5), (rp-vec3(0.,1.,-1.4))*vec3(.45,.5,.5)));
        vec3 irradianceRoom = vec3(.11,.12,.14)*(.4+.6*max(rn.y,0.));
        irradianceRoom += vec3(.33,.19,.095)*deskPool;
        irradianceRoom += vec3(.11,.15,.21)*screenPool*(.35+.65*max(-rn.z,0.));
        irradianceRoom += vec3(.23,.16,.105)*doorwayPool;
        reflectedLight.indirectDiffuse += (irradianceRoom + .6*vRoomBake) * uRoomBounce * material.diffuseColor * (1.0 / 3.14159265);
      `)
  }
  const oldKey = m.customProgramCacheKey.bind(m)
  const key = oldKey()
  m.customProgramCacheKey = () => key + '/room-irradiance-v37'
  return m
}

const HERO_ASPECT = MONITOR.w / MONITOR.h
const VIDEO_ASPECT = 512 / 854 // the supplied clip and its poster

function makeKit(level: number, geo: RoomGeo) {
  const probe = level >= 1 ? RX.probe : null
  const std = (o: THREE.MeshStandardMaterialParameters) => roomIrradiance(new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o }))
  const apertureTex = (() => {
    const { canvas, ctx } = makeCanvas(4, 128)
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, '#5a6f96'); g.addColorStop(0.5, '#a8a6a0'); g.addColorStop(1, '#e8b27a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128)
    return toTexture(canvas, { mipmaps: false, aniso: 1 })
  })()
  const leafTex = doorLeafTexture()
  const bake = new THREE.CanvasTexture(geo.floorBake)
  bake.flipY = false
  bake.colorSpace = THREE.NoColorSpace
  bake.generateMipmaps = false
  bake.minFilter = bake.magFilter = THREE.LinearFilter
  const mats = {
    walls: std({ map: RX.wall, bumpMap: RX.wall, bumpScale: 0.00065, vertexColors: true, roughness: 0.94 }),
    floor: roomIrradiance(bakedMaterial(bake, { map: RX.floor, bumpMap: RX.floor, bumpScale: 0.0012, roughness: 0.72, metalness: 0, envMap: probe, envMapIntensity: 0.25 }, 'roomFloorBake')),
    matte: std({ vertexColors: true, roughness: 0.88 }),
    satin: std({ vertexColors: true, roughness: 0.52, envMap: probe, envMapIntensity: 0.22 }),
    metal: std({ vertexColors: true, roughness: 0.36, metalness: 0.85, envMap: probe, envMapIntensity: 0.75 }),
    wood: std({ map: RX.wood, bumpMap: RX.wood, bumpScale: 0.0008, vertexColors: true, roughness: 0.64, envMap: probe, envMapIntensity: 0.25 }),
    fabric: std({ map: RX.fabric, bumpMap: RX.fabric, bumpScale: 0.0004, vertexColors: true, roughness: 1 }),
    foam: std({ map: RX.grain, vertexColors: true, roughness: 1 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    rug: bakedMaterial(bake, { map: RX.rug, roughness: 1 }, 'roomRugBake'),
    daw: makeDisplay(RX.daw, PLACE.daw.w / PLACE.daw.h, 512 / 288, 0.82),
    screen: makeDisplay(RX.posterPlay ?? RX.poster, HERO_ASPECT, VIDEO_ASPECT, 0.7),
    phone: new THREE.MeshBasicMaterial({ map: RX.phone, toneMapped: false, color: new THREE.Color(0.7, 0.7, 0.75) }),
    keys: std({ map: RX.keys, roughness: 0.5 }),
    cover: std({ map: A.covers.alterco, roughness: 0.32, emissive: '#ffffff', emissiveMap: A.covers.alterco, emissiveIntensity: 0.14, envMap: probe, envMapIntensity: 0.4 }),
    aperture: new THREE.MeshBasicMaterial({ map: apertureTex, fog: false, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(1.3, 1.3, 1.4) }),
    leaf: std({ map: leafTex, roughness: 0.55 }),
    shadow: new THREE.MeshBasicMaterial({ map: RX.blob, color: '#000', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  }
  const crt = level >= 1
    ? new THREE.ShaderMaterial({ vertexShader: crtVert, fragmentShader: crtFrag, uniforms: { uMap: { value: RX.signal }, uTime: { value: 0 }, uInst: { value: 0.35 }, uBright: { value: 1.25 } }, toneMapped: false })
    : new THREE.MeshBasicMaterial({ map: RX.signal, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) })
  const disposables: { dispose(): void }[] = [apertureTex, leafTex, bake, crt, ...Object.values(mats)]
  return { mats, crt, disposables }
}

type RoomKit = ReturnType<typeof makeKit>

export function RoomWorld({ detail }: { detail: boolean }) {
  const level = rt.quality.level
  const geo = useMemo(() => buildRoomGeometry(level), [level])
  const kit = useMemo(() => makeKit(level, geo), [level, geo])
  useEffect(() => () => kit.disposables.forEach((d) => d.dispose()), [kit])
  useEffect(() => () => { Object.values(geo).forEach((g) => g && 'dispose' in g && (g as THREE.BufferGeometry).dispose()) }, [geo])

  // the high-detail photo tier replaces the low-cost one once it has arrived
  const portrait = (detail && RX.portraitHi) || RX.portrait
  const live = (detail && RX.liveHi) || RX.live
  const signal = (detail && RX.signalHi) || RX.signal
  const probe = level >= 1 ? RX.probe : null
  const photoMats = useMemo(() => ({
    // behind glass (framed) / a glossy paper print: a low roughness, the room probe in its sheen
    portrait: new THREE.MeshStandardMaterial({ map: portrait, roughness: 0.28, emissive: '#ffffff', emissiveMap: portrait, emissiveIntensity: 0.2, envMap: probe, envMapIntensity: 0.5 }),
    live: new THREE.MeshStandardMaterial({ map: live, roughness: 0.5, emissive: '#ffffff', emissiveMap: live, emissiveIntensity: 0.22, envMap: probe, envMapIntensity: 0.25 }),
  }), [portrait, live, probe])
  useEffect(() => () => { photoMats.portrait.dispose(); photoMats.live.dispose() }, [photoMats])
  useEffect(() => {
    if (kit.crt instanceof THREE.ShaderMaterial) kit.crt.uniforms.uMap.value = signal
    else { kit.crt.map = signal; kit.crt.needsUpdate = true }
  }, [kit, signal])

  const portraitGeo = useMemo(() => bowedPlane(PRINT.portrait.w, PRINT.portrait.h, 0), [])
  const liveGeo = useMemo(() => bowedPlane(PRINT.live.w, PRINT.live.h, 0.008), [])
  const glassGeo = useMemo(() => crtGlass(PLACE.crt.glass[0], PLACE.crt.glass[1]), [])
  useEffect(() => () => { portraitGeo.dispose(); liveGeo.dispose(); glassGeo.dispose() }, [portraitGeo, liveGeo, glassGeo])

  // contact shadows under the taped-up paper (one merged, multiplied layer); framed pictures carry their own depth
  const shadows = useMemo(() => {
    const items: { x: number; y: number; z: number; ry: number; w: number; h: number }[] = [
      { x: 3.19, y: 1.17, z: -3.45, ry: -Math.PI / 2, w: 2.0, h: 1.55 },
      { x: -3.19, y: 1.25, z: -3.2, ry: Math.PI / 2, w: 1.3, h: 1.5 },
      { x: -3.19, y: 0.85, z: -4.55, ry: Math.PI / 2, w: 1.15, h: 0.85 },
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
      <Workstation kit={kit} level={level} />
      <mesh geometry={shadows} material={kit.mats.shadow} renderOrder={1} />
      <Prints geoP={portraitGeo} geoL={liveGeo} mats={photoMats} kit={kit} detail={detail} />
      <Crt kit={kit} glass={glassGeo} />
      {detail && <Paste />}
      <Lighting level={level} kit={kit} />
      <Interactions />
      <Warm />
    </group>
  )
}

function RoomSurfaces({ geo, kit }: { geo: RoomGeo; kit: RoomKit }) {
  const m = kit.mats
  return (
    <>
      <mesh geometry={geo.walls} material={m.walls} />
      <mesh geometry={geo.floor} material={m.floor} />
      <mesh geometry={geo.matte} material={m.matte} />
      <mesh geometry={geo.satin} material={m.satin} />
      <mesh geometry={geo.metal} material={m.metal} />
      <mesh geometry={geo.wood} material={m.wood} />
      <mesh geometry={geo.fabric} material={m.fabric} />
      <mesh geometry={geo.foam} material={m.foam} />
      <mesh geometry={geo.glow} material={m.glow} />
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

const _e = new THREE.Euler()
const _v = new THREE.Vector3()

/** the hero: the displays, the keyboard's controller strip, the phone — the physical bodies are in the merged batches (build.ts) */
function Workstation({ kit, level }: { kit: RoomKit; level: number }) {
  const state = useRef({ live: false, hover: 0, tex: null as THREE.Texture | null })
  const phoneMat = kit.mats.phone as THREE.MeshBasicMaterial
  const hero = kit.mats.screen as THREE.ShaderMaterial
  const phone = PLACE.phone
  const phonePos = useMemo(() => _v.set(0, 0, 0.0052).applyEuler(_e.set(-0.3, 0.3, 0, 'YXZ')).add(new THREE.Vector3(phone.x, phone.y - 0.003, phone.z - 0.002)).toArray() as [number, number, number], [phone.x, phone.y, phone.z])
  const keysGeo = useMemo(() => {
    // the controller strip: the top part of the keys texture over the back half of the body (level 0: the whole board, keys included)
    const g = new THREE.PlaneGeometry(0.98, level >= 1 ? 0.15 : 0.265)
    if (level >= 1) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.52 + uv.getY(i) * 0.48) }
    return g
  }, [level])
  useEffect(() => () => keysGeo.dispose(), [keysGeo])
  useWorldFrame('room', () => {
    const s = state.current
    const wantLive = vid.live && videoMode() === 'texture' && !!vid.el && vid.el.readyState >= 2
    if (wantLive !== s.live) {
      s.live = wantLive
      const t = wantLive ? videoTexture() : null
      hero.uniforms.uMap.value = t ?? RX.posterPlay ?? RX.poster
      hero.uniforms.uVideo.value = t?.isVideoTexture ? 1 : 0
    }
    // idle: a dim, low-cost poster; the focused monitor lights the room instead
    const k = s.live ? 1 : 0.62 + 0.2 * hover.video
    const b = 0.62 + (1 - 0.62) * room.push
    hero.uniforms.uBright.value = s.live ? 1.0 : Math.max(k, b * 0.7)
    // the glass reflects less of the (dimmed) room while the visitor watches
    const dim = 1 - 0.6 * room.dim
    hero.uniforms.uDim.value = dim
    ;(kit.mats.daw as THREE.ShaderMaterial).uniforms.uDim.value = dim
    phoneMat.color.setScalar(0.7 + 0.5 * hover.tiktok)
  }, 0)
  const kz = PLACE.keys.z
  return (
    <group>
      {/* the keyboard's controller strip (lies on the body, behind the keybed) */}
      <mesh geometry={keysGeo} position={[PLACE.keys.x, PLACE.deskTop + 0.0425, level >= 1 ? kz - 0.075 : kz]} rotation={[-Math.PI / 2, 0, 0]} material={kit.mats.keys} />
      {/* secondary (landscape) monitor: an abstract arrangement view — not readable, nothing invented */}
      <mesh position={[PLACE.daw.x, PLACE.daw.y, PLACE.daw.z]} material={kit.mats.daw}>
        <planeGeometry args={[PLACE.daw.w, PLACE.daw.h]} />
      </mesh>
      {/* HERO: the vertical studio display (9:16 panel) — poster outside PLAY, the real video when focused, letterboxed with its exact aspect */}
      <mesh position={[PLACE.hero.x, PLACE.hero.y, PLACE.hero.z]} material={kit.mats.screen}>
        <planeGeometry args={[PLACE.hero.w, PLACE.hero.h]} />
      </mesh>
      {/* the phone on the desk (TikTok): the lit face of the body built in the satin batch */}
      <mesh position={phonePos} rotation={[-0.3, 0.3, 0, 'YXZ']} material={phoneMat}>
        <planeGeometry args={[0.064, 0.138]} />
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
  const P = PLACE
  return (
    <group>
      {/* WHO IS HOODDINO? — right wall (faces −x): the framed portrait (recessed behind its mat), the exact biography, the painted headline and stencilled meta */}
      <mesh geometry={geoP} material={mats.portrait} position={[P.portrait.x - 0.0135, P.portrait.y, P.portrait.z]} rotation={[0, -Math.PI / 2, 0]} />
      {paraMat && <mesh material={paraMat} position={[3.17, 1.17, -3.45]} rotation={[0, -Math.PI / 2, 0.012]}><planeGeometry args={[1.8, 1.35]} /></mesh>}
      {headMat && <mesh material={headMat} position={[3.19, 2.3, -4.45]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[2.0, 0.833]} /></mesh>}
      {metaMat && <mesh material={metaMat} position={[3.19, 0.25, -4.45]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[2.6, 0.433]} /></mesh>}
      {/* LIVE — left wall (faces +x): the documentary print taped up, and the card that points to Instagram for dates */}
      <mesh geometry={geoL} material={mats.live} position={[P.live.x + 0.007, P.live.y, P.live.z]} rotation={[0, Math.PI / 2, 0]} />
      {cardMat && <mesh ref={card} material={cardMat} position={[-3.15, 0.85, -4.55]} rotation={[0, Math.PI / 2, -0.035]}><planeGeometry args={[0.9, 0.6]} /></mesh>}
      {/* ALTERCO — the official artwork, untouched, in a slim frame with a mat, lit by the picture light above */}
      <mesh material={kit.mats.cover} position={[P.alterco.x + 0.0105, P.alterco.y, P.alterco.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[PRINT.art, PRINT.art]} />
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
  const t = PLACE.crt
  const off = 0.246
  return <mesh geometry={glass} material={kit.crt} position={[t.x + Math.sin(t.ry) * off, 0.62 + 0.23, t.z + Math.cos(t.ry) * off]} rotation={[0, t.ry, 0]} />
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
      const e = 0.002
      if (side === 'R') { g.rotateY(-Math.PI / 2); g.translate(3.2 - e, y, a) }
      else if (side === 'L') { g.rotateY(Math.PI / 2); g.translate(-3.2 + e, y, a) }
      else if (side === 'B') { g.translate(a, y, -8.6 + e) }
      else { g.rotateY(Math.PI); g.translate(a, y, -1.25 - e) }
      parts.push(g)
    }
    const merged = mergeParts(parts)
    const mat = new THREE.MeshStandardMaterial({ map: RX.atlas, transparent: true, depthWrite: false, roughness: 0.95 })
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

/**
 * motivated lights only: the doorway's dusk spill, the ceiling battens' wash, the desk lamp, the cold LED on the back wall, the red work
 * lamp, and the glow of the displays. (the picture light, track spots and strips are baked into the surfaces they hit — see build.ts)
 */
function Lighting({ level, kit }: { level: number; kit: RoomKit }) {
  const lamp = useRef<THREE.PointLight>(null)
  const blue = useRef<THREE.PointLight>(null)
  const red = useRef<THREE.PointLight>(null)
  const wash = useRef<THREE.RectAreaLight>(null)
  const door = useRef<THREE.PointLight>(null)
  const scr = useRef<THREE.RectAreaLight>(null)
  useWorldFrame('room', () => {
    const d = 1 - 0.55 * room.dim
    if (lamp.current) lamp.current.intensity = 2.4 * (1 - 0.35 * room.dim)
    if (blue.current) blue.current.intensity = 0.65 * d
    if (red.current) red.current.intensity = 0.7 * d
    if (wash.current) wash.current.intensity = 55 * d
    if (door.current) door.current.intensity = 3.2 * d
    // the video (lit) lights the desk, the keyboard, the wall around it
    if (scr.current) scr.current.intensity = (1.2 + 1.8 * room.push) * (vid.live ? 1.15 : 1)
    const walls = kit.mats.walls as THREE.MeshStandardMaterial
    walls.color.setScalar(1 - 0.25 * room.dim)
  }, 0)
  return (
    <>
      {level >= 1 && <rectAreaLight ref={wash} position={[0.2, L.h - 0.077, -3.6]} rotation={[-Math.PI / 2, 0, 0]} color="#d8dfe5" intensity={55} width={0.075} height={1.14} />}
      <pointLight ref={door} position={[0, 2.0, -1.7]} color="#ffb27c" intensity={3.2} distance={6.5} decay={2} />
      <pointLight ref={lamp} position={[PLACE.lamp.x, PLACE.lamp.y - 0.06, PLACE.lamp.z]} color="#ffb070" intensity={2.4} distance={4.2} decay={2} />
      {level >= 1 && <pointLight ref={blue} position={[-1.8, 2.5, -7.6]} color="#a2b5d1" intensity={0.65} distance={6} decay={2} />}
      {level >= 2 && <pointLight ref={red} position={[RED_LAMP.x, RED_LAMP.y - 0.05, RED_LAMP.z]} color="#ffc09a" intensity={0.7} distance={4.5} decay={2} />}
      {level >= 2 && <rectAreaLight ref={scr} position={[PLACE.hero.x, PLACE.hero.y, PLACE.hero.z + 0.018]} rotation={[0, Math.PI, 0]} color="#bcd0ff" intensity={1.2} width={PLACE.hero.w} height={PLACE.hero.h} />}
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
      <Hit id="video" pos={[MONITOR.x, MONITOR.y, -8.15]} size={[0.5, 0.78, 0.3]} label={focused() ? undefined : 'PLAY'} onClick={() => { if (!focused()) focusVideo() }} />
      <Hit id="spotify" pos={[PLACE.spkR.x, 1.02, -8.0]} size={[0.5, 0.7, 0.5]} label="SPOTIFY ↗" onClick={link('spotify')} />
      <Hit id="tiktok" pos={[PLACE.phone.x, 0.86, -7.98]} size={[0.3, 0.3, 0.3]} label="TIKTOK ↗" onClick={link('tiktok')} />
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
    for (const t of [RX.wall, RX.floor, RX.grain, RX.fabric, RX.rug, RX.wood, RX.keys, RX.daw, RX.portrait, RX.live, RX.signal, RX.poster, RX.posterPlay]) {
      try { if (t) gl.initTexture(t) } catch { /* uploaded on first use instead */ }
    }
  })
  return null
}
