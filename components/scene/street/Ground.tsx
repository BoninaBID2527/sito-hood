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

const GROUND_W = 44
const GROUND_L = 176
const GROUND_CZ = -56

export function Ground() {
  const mats = useMemo(() => {
    A.asphalt.repeat.set(1, 1)
    const asphalt = streetMat({ map: A.asphalt, color: '#6c6c76', roughness: 0.82, metalness: 0, aoBase: 0.7, bump: A.asphalt, bumpAmt: 0.8, bumpBlur: 6, wet: A.puddle, macro: 0.7 })
    A.sidewalk.repeat.set(1, 1)
    const walk = streetMat({ map: A.sidewalk, color: '#6f6a62', roughness: 0.9, aoBase: 0.6 })
    return { asphalt, walk }
  }, [])

  const groundGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(GROUND_W, GROUND_L)
    tileUV(g, GROUND_W, GROUND_L, 4.2)
    return g
  }, [])

  // sidewalks follow each wall segment
  const walks = useMemo(() => {
    const b = new THREE.BufferGeometry()
    void b
    return SEGS.map((s) => {
      const len = s.z0 - s.z1
      const g = new THREE.BoxGeometry(0.95, 0.16, len)
      tileUV(g, 0.95 + len, 2, 3)
      return { geo: g, x: s.side * (s.hw - 0.475), z: (s.z0 + s.z1) / 2, key: `${s.side}${s.z0}` }
    })
  }, [])

  useEffect(
    () => () => {
      groundGeo.dispose()
      walks.forEach((w) => w.geo.dispose())
      mats.asphalt.dispose()
      mats.walk.dispose()
    },
    [groundGeo, walks, mats],
  )

  return (
    <group>
      <mesh geometry={groundGeo} material={mats.asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, GROUND_CZ]} receiveShadow />
      {walks.map((w) => (
        <mesh key={w.key} geometry={w.geo} material={mats.walk} position={[w.x, 0.08, w.z]} />
      ))}
      <PuddleLayer />
    </group>
  )
}

/* ───────────────────────── wet-ground reflections ───────────────────────── */

const puddleVert = /* glsl */ `
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

const puddleFrag = (real: boolean) => /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform sampler2D tMask;
uniform float uTime;
uniform float uContam;
uniform float uWet;
uniform float uPud;
uniform vec3 uRip;
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
  float pn = vn(pw * 6.0) * 0.6 + vn(pw * 19.0) * 0.4;
  float thr = mix(0.66, 0.2, uPud);
  float m = smoothstep(thr - 0.06, thr + 0.03, wf.r + (pn - 0.5) * 0.16);
  float damp = clamp(wf.g + (pn - 0.5) * 0.4 - 0.12 + uPud * 0.18, 0.0, 1.0) * (0.55 + 0.45 * uWet);
  damp = max(damp, m);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(V.y, 0.0, 1.0);
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
  vec2 p = vWorld.xz;
  vec2 dist = vec2(sin(p.x * 9.0 + uTime * 1.4) * sin(p.y * 7.0 - uTime * 1.1), cos(p.x * 5.0 + p.y * 6.0 + uTime)) * 0.002 * (0.3 + m);
  // damp asphalt: reflection is broken up by micro-relief instead of mirror-clean
  dist += (vec2(vn(p * 23.0), vn(p * 23.0 + 9.0)) - 0.5) * 0.02 * (1.0 - m) * damp;
  dist += vec2(sin(p.y * 3.0 + uTime * 1.2), cos(p.x * 3.0 - uTime)) * 0.012 * uContam;
  vec2 rp = p - uRip.xy;
  float rd = length(rp);
  dist += normalize(rp + 1e-4) * sin(rd * 24.0 - uTime * 7.0) * exp(-rd * 1.5) * uRip.z * 0.025;
  vec3 c;
  ${real ? `
  vec2 uv = vUv.xy / vUv.w + dist;
  float blur = mix(0.02, 0.0012, m);
  c = texture2D(tDiffuse, uv).rgb * 0.36;
  c += texture2D(tDiffuse, uv + vec2(blur, 0.0)).rgb * 0.16;
  c += texture2D(tDiffuse, uv - vec2(blur, 0.0)).rgb * 0.16;
  c += texture2D(tDiffuse, uv + vec2(0.0, blur * 1.6)).rgb * 0.16;
  c += texture2D(tDiffuse, uv - vec2(0.0, blur * 1.6)).rgb * 0.16;
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
  // thin-film oil sheen inside standing water; grows with contamination
  float oil = smoothstep(0.35, 0.8, wf.b + (pn - 0.5) * 0.4) * m;
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + wf.b * 1.6 + pw.y * 0.02 + uTime * 0.03));
  c = mix(c, c * (0.55 + film * 1.0), oil * (0.07 + 0.6 * uContam + 0.06 * uPud));
  float damped = (1.0 - m) * damp;
  float a = clamp(m * 0.96 + damped * 0.30, 0.0, 1.0) * mix(0.35, 1.0, clamp(fres * 3.5, 0.0, 1.0));
  // puddle darkening so the water reads as depth, not paint
  c *= color * mix(0.62, 0.95, m);
  gl_FragColor = vec4(c, a);
}
`

function PuddleLayer() {
  const tier = useStore((s) => s.tier)
  const scene = useThree((s) => s.scene)
  const q = rt.quality
  const real = q.reflector && tier !== 'low'
  const group = useRef<THREE.Group>(null)
  const uni = useRef<Record<string, THREE.IUniform> | null>(null)
  const rip = useRef({ x: 0, z: 0, s: 0 })
  const lastEgg = useRef(-100)

  const { obj, mat } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(28, 142)
    const shader = {
      name: 'PuddleReflector',
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        tMask: { value: A.puddle },
        uTime: { value: 0 },
        uContam: { value: 0 },
        uWet: { value: 1 },
        uPud: { value: 0 },
        uRip: { value: new THREE.Vector3() },
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
        multisample: q.tier === 'high' ? 2 : 0,
        shader,
      })
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
    object.position.set(0, 0.02, -51)
    object.renderOrder = 2
    return { obj: object, mat: material }
  }, [real, q])

  useEffect(() => {
    uni.current = mat.uniforms
    return () => {
      ;(obj as any).dispose?.()
      obj.geometry.dispose()
      mat.dispose()
    }
  }, [obj, mat])

  useFrame((_, dt) => {
    const u = mat.uniforms
    u.uTime.value = rt.time
    u.uContam.value = rt.fx.contam
    u.uPud.value = streetU.uPud.value
    u.uWet.value = streetU.uWet.value
    u.uHor.value.copy(palette.horizon).multiplyScalar(0.8)
    u.uSky.value.copy(palette.skyMid).multiplyScalar(0.7)
    rip.current.s *= Math.exp(-dt * 1.4)
    u.uRip.value.set(rip.current.x, rip.current.z, rip.current.s)
  })

  const sample = (uvx: number, uvy: number) => {
    const c = A.puddle.image as HTMLCanvasElement
    const ctx = c.getContext('2d')!
    const d = ctx.getImageData(Math.min(c.width - 1, Math.max(0, Math.floor(uvx * c.width))), Math.min(c.height - 1, Math.max(0, Math.floor(uvy * c.height))), 1, 1).data
    return d[0] / 255
  }

  return (
    <group ref={group}>
      <primitive
        object={obj}
        onPointerMove={(e: any) => {
          if (rt.touch || !e.uv) return
          const wet = sample(e.uv.x, e.uv.y)
          if (wet < 0.42) return
          rip.current.x = e.point.x
          rip.current.z = e.point.z
          rip.current.s = Math.min(1.4, rip.current.s + 0.12)
          // the "wrong" puddle: hovering the one mid-alley pool distorts reality for a beat
          const dx = e.point.x - 0.2, dz = e.point.z + 41
          if (dx * dx + dz * dz < 9 && rt.time - lastEgg.current > 14) {
            lastEgg.current = rt.time
            rt.fx.ripple = 1
            rt.fx.rippleX = e.pointer ? e.pointer.x * 0.5 + 0.5 : 0.5
            rt.fx.rippleY = e.pointer ? e.pointer.y * 0.5 + 0.5 : 0.5
            rt.impulse.rgb = 0.025
            useStore.getState().say('THE WATER REMEMBERS', 'It looked back at you.')
            useStore.getState().markEgg('puddle')
          }
        }}
      />
    </group>
  )
}

