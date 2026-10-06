'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { tileUV } from '@/lib/geo'
import { palette } from '@/lib/timeOfDay'
import { streetMat, streetU } from './materials'
import { SEGS } from './layout'
import { useStore } from '@/lib/store'
import { audio } from '@/lib/audio'
import { throttleReflector } from './reflectThrottle'
import { buildGroundGeometry, buildKerbs } from './groundBuild'

export function Ground() {
  const mats = useMemo(() => {
    A.asphalt.repeat.set(1, 1)
    const asphalt = streetMat({ map: A.asphalt, color: '#6c6c76', roughness: 0.82, metalness: 0, aoBase: 0.7, bump: A.asphalt, bumpAmt: 0.8, bumpBlur: 6, wet: A.puddle, macro: 0.7 })
    A.sidewalk.repeat.set(1, 1)
    const walk = streetMat({ map: A.sidewalk, color: '#6f6a62', roughness: 0.9, aoBase: 0.6 })
    const kerb = streetMat({ map: A.sidewalk, color: '#86837e', roughness: 0.86, aoBase: 0.5, macro: 0.8, seed: 8.1, vertexColors: true })
    const iron = streetMat({ color: '#17171a', roughness: 0.8, metalness: 0.3, aoBase: 0.6, vertexColors: true })
    return { asphalt, walk, kerb, iron }
  }, [])

  // the road is a real surface: crown, gutter dish, plaza fall — in a few big faces (see groundBuild.ts for why not a dense grid)
  const groundGeo = useMemo(() => buildGroundGeometry(), [])
  const kerbs = useMemo(() => buildKerbs(), [])
  const backing = useMemo(() => new THREE.PlaneGeometry(48, 160).rotateX(-Math.PI / 2), [])
  const backingMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0b0a0a' }), [])
  useEffect(() => () => { backing.dispose(); backingMat.dispose() }, [backing, backingMat])

  // sidewalks follow each wall segment
  const walks = useMemo(() => {
    return SEGS.map((s) => {
      const len = s.z0 - s.z1
      const g = new THREE.BoxGeometry(0.95, 0.19, len)
      tileUV(g, 0.95 + len, 2, 3)
      return { geo: g, x: s.side * (s.hw - 0.475), z: (s.z0 + s.z1) / 2, key: `${s.side}${s.z0}` }
    })
  }, [])

  useEffect(
    () => () => {
      groundGeo.dispose()
      kerbs.stone?.dispose()
      kerbs.iron?.dispose()
      walks.forEach((w) => w.geo.dispose())
      mats.asphalt.dispose()
      mats.walk.dispose()
      mats.kerb.dispose()
      mats.iron.dispose()
    },
    [groundGeo, kerbs, walks, mats],
  )

  return (
    <group>
      <mesh geometry={groundGeo} material={mats.asphalt} receiveShadow />
      {/* a dark under-layer: where two ground slabs meet at different kerb lines the rasteriser can leave hairline cracks at distance
          (sky showed through as a white speckle); whatever shows through now is asphalt-dark instead */}
      <mesh geometry={backing} material={backingMat} position={[0, -0.07, -48]} renderOrder={-1} />
      {walks.map((w) => (
        <mesh key={w.key} geometry={w.geo} material={mats.walk} position={[w.x, 0.065, w.z]} receiveShadow />
      ))}
      {kerbs.stone && <mesh geometry={kerbs.stone} material={mats.kerb} receiveShadow />}
      {kerbs.iron && <mesh geometry={kerbs.iron} material={mats.iron} />}
      <PuddleLayer />
    </group>
  )
}

/* ───────────────────────── wet-ground reflections ───────────────────────── */

export const puddleVert = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec2 vMask;
varying vec3 vWorld;
void main() {
  vUv = textureMatrix * vec4(position, 1.0);
  vMask = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const puddleFrag = (real: boolean) => /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform sampler2D tMask;
uniform float uTime;
uniform float uContam;
uniform float uWet;
uniform float uPud;
uniform vec3 uRip;
uniform float uEgg;
uniform float uMem;
uniform vec3 uHor;
uniform vec3 uSky;
varying vec4 vUv;
varying vec2 vMask;
varying vec3 vWorld;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main() {
  vec3 wf = texture2D(tMask, vMask).rgb;
  vec2 pw = vWorld.xz;
  // puddle edge noise is a ~20 cycles/m hash: past ~15 m it is sub-pixel and would only alias into scattered 1-px puddles (white speckle on a sunlit reflection),
  // so with distance the noise relaxes to its mean and the edge widens (a distant puddle is a soft shape, not confetti)
  float dd_ = length(cameraPosition - vWorld);
  float far_ = smoothstep(10.0, 34.0, dd_);
  float pn = mix(vn(pw * 6.0) * 0.6 + vn(pw * 19.0) * 0.4, 0.5, far_);
  float thr = mix(0.66, 0.2, uPud);
  float m = smoothstep(thr - 0.06 - 0.18 * far_, thr + 0.03 + 0.18 * far_, wf.r + (pn - 0.5) * 0.16);
  float damp = clamp(wf.g + (pn - 0.5) * 0.4 - 0.12 + uPud * 0.18, 0.0, 1.0) * (0.55 + 0.45 * uWet);
  damp = max(damp, m);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(V.y, 0.0, 1.0);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
  vec2 p = vWorld.xz;
  vec2 dist = vec2(sin(p.x * 9.0 + uTime * 1.4) * sin(p.y * 7.0 - uTime * 1.1), cos(p.x * 5.0 + p.y * 6.0 + uTime)) * 0.002 * (0.3 + m);
  // damp asphalt: reflection is broken up by micro-relief instead of mirror-clean
  // (fades out with distance: ~40 cycles per metre is far below one pixel past ~25 m, where it would only alias into per-pixel jitter = white speckle)
  float reliefFade = 1.0 - smoothstep(5.0, 24.0, length(cameraPosition - vWorld));
  dist += (vec2(vn(p * vec2(37.0, 11.0)), vn(p * vec2(41.0, 13.0) + 9.0)) - 0.5) * 0.006 * (1.0 - m) * damp * reliefFade;
  dist += vec2(sin(p.y * 3.0 + uTime * 1.2), cos(p.x * 3.0 - uTime)) * 0.012 * uContam;
  vec2 rp = p - uRip.xy;
  float rd = length(rp);
  dist += normalize(rp + 1e-4) * sin(rd * 24.0 - uTime * 7.0) * exp(-rd * 1.5) * uRip.z * 0.025;
  // the impossible reflection: one puddle shows a tall iridescent doorway that is not standing above it.
  // analytic (works on the real and the cheap reflection tier alike); nothing exists in the street at that spot.
  float eggM = 0.0;
  vec3 eggC = vec3(0.0);
  {
    vec2 ep = vWorld.xz - vec2(0.2, -41.0);
    float er = length(ep);
    float ew = (1.0 - smoothstep(1.35, 2.35, er + (pn - 0.5) * 0.7)) * m;
    if (ew > 0.002) {
      vec3 Rf = vec3(-V.x, V.y, -V.z);
      float t = (-49.4 - vWorld.z) / min(Rf.z, -0.02);
      vec3 hp = vWorld + Rf * t;
      float sway = sin(uTime * 0.35) * 0.03 + uMem * sin(uTime * 0.9 + hp.y) * 0.04;
      float hx = (hp.x - 0.2 - sway) * (1.0 + uMem * 0.06 * sin(hp.y * 2.0));
      float hy = hp.y;
      // arch: tall frame with a pointed head, a vertical slit of light inside
      float half_ = 0.95 - max(0.0, hy - 5.2) * 0.2;
      float inside = step(abs(hx), half_) * step(0.0, hy) * step(hy, 8.2);
      float frame = inside * smoothstep(0.16, 0.0, half_ - abs(hx)) ;
      float slit = inside * smoothstep(0.2, 0.0, abs(hx)) * smoothstep(0.0, 1.0, hy) * smoothstep(8.2, 5.0, hy);
      vec3 spec = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + hy * 0.07 + hx * 0.2 + uTime * 0.025));
      eggC = (spec * (frame * 1.1 + 0.18 * inside) + vec3(0.55, 0.7, 1.25) * slit * 0.9) * (0.5 + uEgg * 2.4);
      eggM = ew * clamp(inside * 0.9, 0.0, 1.0);
      // a hard flash on touch/hover: the pane answers for a moment
      dist += normalize(ep + 1e-4) * sin(er * 18.0 - uTime * 6.0) * exp(-er * 1.3) * uEgg * 0.02;
    }
  }
  vec3 c;
  ${real ? `
  vec2 uv = vUv.xy / vUv.w + dist;
  // reflection clarity follows the surface: still water is clear, damp asphalt is rough → the reflection is a vertical smear, never a mirror.
  // 4 jittered taps (+ centre) on a per-pixel rotated, vertically stretched kernel (noise instead of a visible tap pattern)
  float rough = (1.0 - m) * (0.35 + 0.65 * damp);
  float br = mix(0.0012, 0.017, rough);
  // a FIXED vertical smear (wet asphalt streaks light vertically); a per-pixel rotated noise kernel turned every bright-edge reflection into 1-px white speckle
  vec2 o1 = vec2(0.0, 1.0) * br * 1.9;
  vec2 o2 = vec2(0.85, 0.35) * br * 1.9;
  vec3 CL = vec3(mix(2.6, mix(1.1, 0.55, smoothstep(5.0, 16.0, dd_)), 1.0 - m));
  c = min(texture2D(tDiffuse, uv).rgb, CL) * 0.28;
  c += min(texture2D(tDiffuse, uv + o1).rgb, CL) * 0.18;
  c += min(texture2D(tDiffuse, uv - o1).rgb, CL) * 0.18;
  c += min(texture2D(tDiffuse, uv + o2).rgb, CL) * 0.18;
  c += min(texture2D(tDiffuse, uv - o2).rgb, CL) * 0.18;
  // far field: the mirrored render's far horizon is where clipped kerb/sidewalk slivers alias against the bright sky behind them (1-px white speckle).
  // Rough wet asphalt keeps no structure out there anyway, so beyond ~10 m (damp asphalt; real puddles keep theirs) the reflection relaxes to the analytic horizon/sky gradient (the cheap tier's colour).
  {
    float gF = smoothstep(-0.1, 1.0, V.y * 3.0);
    vec3 cFar = mix(uHor, uSky, gF) * 0.55;
    c = mix(c, cFar, smoothstep(5.0, 20.0, dd_) * (1.0 - m));
  }
  if (uContam > 0.04) {
    float s = 0.008 * uContam;
    c.r = mix(c.r, texture2D(tDiffuse, uv + vec2(s, 0.0)).r, 0.8);
    c.b = mix(c.b, texture2D(tDiffuse, uv - vec2(s, 0.0)).b, 0.8);
  }
  ` : `
  float g = smoothstep(-0.1, 1.0, V.y * 3.0);
  c = mix(uHor, uSky, g) * (0.8 + 0.2 * sin(p.x * 6.0 + dist.x * 400.0));
  c += uHor * pow(max(0.0, 1.0 - abs(p.x) * 0.5), 2.0) * 0.35;
  `}
  c = mix(c, c * 0.35 + eggC, eggM * (0.42 + uMem * 0.12));
  // thin-film oil sheen inside standing water; grows with contamination
  float oil = smoothstep(0.35, 0.8, wf.b + (pn - 0.5) * 0.4) * m;
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + wf.b * 1.6 + pw.y * 0.02 + uTime * 0.03));
  c = mix(c, c * (0.55 + film * 1.0), oil * (0.07 + 0.6 * uContam + 0.06 * uPud));
  float edge = m * (1.0 - smoothstep(0.55, 0.95, m)) + (1.0 - m) * smoothstep(0.0, 0.6, m);
  float eggEdge = exp(-length(vWorld.xz - vec2(0.2, -41.0)) * 0.55) * uMem * smoothstep(0.02, 0.5, m) * (1.0 - smoothstep(0.75, 1.0, m));
  c += film * eggEdge * 0.35;
  float damped = (1.0 - m) * damp;
  float a = clamp(m * 0.96 + damped * 0.30, 0.0, 1.0) * mix(0.35, 1.0, clamp(fres * 3.5, 0.0, 1.0));
  // puddle darkening so the water reads as depth, not paint
  c *= color * mix(0.62, 0.95, m);
  gl_FragColor = vec4(c, a);
}
`

function PuddleLayer() {
  return <WaterSheet mask={A.puddle} size={[28, 142]} position={[0, 0.02, -51]} interactive rising />
}

/** Planar reflection + wetness-field water over a world-aligned mask (street puddles, rooftop ponds). */
export function WaterSheet({ mask, size, position, interactive = false, rising = false }: { mask: THREE.Texture; size: [number, number]; position: [number, number, number]; interactive?: boolean; rising?: boolean }) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  // creation-time quality: the reflector's resolution / existence is fixed for the session; its update cadence adapts live
  const q = useRef(rt.quality).current
  const real = q.reflector
  const group = useRef<THREE.Group>(null)
  const uni = useRef<Record<string, THREE.IUniform> | null>(null)
  const rip = useRef({ x: 0, z: 0, s: 0 })
  const lastEgg = useRef(-100)
  const egg = useRef(0)

  const { obj, mat } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size[0], size[1])
    const shader = {
      name: 'PuddleReflector',
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        tMask: { value: mask },
        uTime: { value: 0 },
        uContam: { value: 0 },
        uWet: { value: 1 },
        uPud: { value: 0 },
        uRip: { value: new THREE.Vector3() },
        uEgg: { value: 0 },
        uMem: { value: 0 },
        uHor: { value: new THREE.Color() },
        uSky: { value: new THREE.Color() },
      },
      vertexShader: puddleVert,
      fragmentShader: puddleFrag(real),
    }
    let object: THREE.Mesh
    let material: THREE.ShaderMaterial
    if (real) {
      const r = new Reflector(geo, {
        color: new THREE.Color(0.92, 0.95, 1.0),
        textureWidth: q.reflectorRes,
        textureHeight: Math.round(q.reflectorRes * 0.62),
        clipBias: 0.003,
        multisample: q.level >= 2 ? 2 : 0,
        shader,
      })
      throttleReflector(r)
      material = r.material as THREE.ShaderMaterial
      object = r
    } else {
      material = new THREE.ShaderMaterial({
        vertexShader: puddleVert.replace('vUv = textureMatrix * vec4(position, 1.0);', 'vUv = vec4(0.0);'),
        fragmentShader: puddleFrag(false),
        uniforms: { ...shader.uniforms, color: { value: new THREE.Color(0.92, 0.95, 1.0) }, textureMatrix: { value: new THREE.Matrix4() } },
      })
      object = new THREE.Mesh(geo, material)
    }
    material.transparent = true
    material.depthWrite = false
    material.polygonOffset = true
    material.polygonOffsetFactor = -2
    material.polygonOffsetUnits = -2
    object.rotation.x = -Math.PI / 2
    object.position.set(...position)
    object.renderOrder = 2
    return { obj: object, mat: material }
  }, [real, q, mask, size, position])

  useEffect(() => {
    // the reflection camera only draws layer 0 (see NoReflect)
    ;(obj as any).getReflectionCamera?.(camera)?.layers.set(0)
    uni.current = mat.uniforms
    return () => {
      ;(obj as any).dispose?.()
      obj.geometry.dispose()
      mat.dispose()
    }
  }, [obj, mat, camera])

  useFrame((_, dt) => {
    obj.visible = !rt.mirror
    void rising
    const u = mat.uniforms
    u.uTime.value = rt.time
    u.uContam.value = Math.max(rt.fx.contam, rt.fx.dissolve)
    u.uPud.value = streetU.uPud.value
    u.uWet.value = streetU.uWet.value
    u.uHor.value.copy(palette.horizon).multiplyScalar(0.8)
    u.uSky.value.copy(palette.skyMid).multiplyScalar(0.7)
    egg.current *= Math.exp(-dt * 0.9)
    u.uEgg.value = egg.current
    u.uMem.value = useStore.getState().dualReturned ? 1 : 0
    rip.current.s *= Math.exp(-dt * 1.4)
    u.uRip.value.set(rip.current.x, rip.current.z, rip.current.s)
  })

  /** the one impossible puddle answers an intentional touch: ripple, a flash in the pane, a far-off note — nothing else */
  const eggTouch = (e: any) => {
    const dx = e.point.x - 0.2, dz = e.point.z + 41
    if (dx * dx + dz * dz > 2.6 * 2.6 || rt.time - lastEgg.current < 9) return
    lastEgg.current = rt.time
    egg.current = 1
    rip.current.x = e.point.x; rip.current.z = e.point.z; rip.current.s = 1.4
    rt.impulse.rgb = Math.max(rt.impulse.rgb, 0.012)
    audio.far()
    useStore.getState().markEgg('puddle')
  }

  const sample = (uvx: number, uvy: number) => {
    const c = mask.image as HTMLCanvasElement
    const ctx = c.getContext('2d')!
    const d = ctx.getImageData(Math.min(c.width - 1, Math.max(0, Math.floor(uvx * c.width))), Math.min(c.height - 1, Math.max(0, Math.floor(uvy * c.height))), 1, 1).data
    return d[0] / 255
  }

  return (
    <group ref={group}>
      <primitive
        object={obj}
        onPointerDown={interactive ? (e: any) => { if (rt.touch && e.point) eggTouch(e) } : undefined}
        onPointerMove={interactive ? (e: any) => {
          if (rt.touch || !e.uv) return
          const wet = sample(e.uv.x, e.uv.y)
          if (wet < 0.42) return
          rip.current.x = e.point.x
          rip.current.z = e.point.z
          rip.current.s = Math.min(1.4, rip.current.s + 0.12)
          eggTouch(e)
        } : undefined}
      />
    </group>
  )
}

