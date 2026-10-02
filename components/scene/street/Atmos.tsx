'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '@/lib/math'
import { rt } from '@/lib/runtime'
import { palette } from '@/lib/timeOfDay'
import { patchSway } from './materials'
import { wallX } from './layout'

/* ───────────────────────── steam ───────────────────────── */

const steamVert = /* glsl */ `
attribute vec3 aBase;
attribute vec4 aRand;
uniform float uTime;
varying vec2 vUv;
varying float vA;
void main() {
  float life = fract(uTime * aRand.y * 0.07 + aRand.x);
  vec3 p = aBase;
  p.y += life * 4.4;
  p.x += sin(life * 6.0 + aRand.x * 20.0) * 0.5 * life + aRand.w * life * 1.3;
  p.z += cos(life * 5.0 + aRand.x * 13.0) * 0.4 * life;
  float size = aRand.z * (0.6 + life * 2.8);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vA = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.3, 1.0, life));
}
`
const steamFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vA;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  float a = smoothstep(1.0, 0.1, d);
  float cut = n(vUv * 4.0 + vA * 3.0 + uTime * 0.05) * 0.6 + n(vUv * 9.0 - uTime * 0.07) * 0.4;
  a *= smoothstep(0.15, 0.85, cut + 0.25);
  gl_FragColor = vec4(uColor, a * vA * uOpacity);
}
`

export interface VentDef {
  x: number
  z: number
}
export const VENTS: VentDef[] = [
  { x: -1.0, z: -9 },
  { x: 0.9, z: -29 },
  { x: -0.4, z: -55 },
  { x: 2.0, z: -79 },
  { x: -3.4, z: -95 },
  { x: 3.8, z: -104 },
]

export function Steam({ list = VENTS, size = 1 }: { list?: VentDef[]; size?: number } = {}) {
  const kit = useMemo(() => {
    const vents = list.slice(0, rt.quality.steam)
    const per = 9
    const count = vents.length * per
    const base = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.setAttribute('position', base.attributes.position)
    g.setAttribute('uv', base.attributes.uv)
    const aBase = new Float32Array(count * 3)
    const aRand = new Float32Array(count * 4)
    const r = rng(55)
    let k = 0
    vents.forEach((v) => {
      for (let i = 0; i < per; i++, k++) {
        aBase.set([v.x + r.range(-0.12, 0.12), (v as any).y ?? 0.05, v.z + r.range(-0.12, 0.12)], k * 3)
        aRand.set([r(), r.range(0.7, 1.3), r.range(0.8, 1.5) * size, r.range(-0.4, 0.4)], k * 4)
      }
    })
    g.setAttribute('aBase', new THREE.InstancedBufferAttribute(aBase, 3))
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(aRand, 4))
    g.instanceCount = count
    const mat = new THREE.ShaderMaterial({
      vertexShader: steamVert,
      fragmentShader: steamFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#b9a99a') }, uOpacity: { value: 0.2 } },
    })
    // manhole covers
    const cover = new THREE.CylinderGeometry(0.46, 0.46, 0.025, 20)
    const cMat = new THREE.MeshStandardMaterial({ color: '#202022', roughness: 0.5, metalness: 0.7 })
    return { g, mat, vents, cover, cMat, base }
  }, [list, size])

  useFrame(() => {
    const u = kit.mat.uniforms
    u.uTime.value = rt.time
    u.uColor.value.copy(palette.horizon).lerp(palette.hemiSky, 0.55).multiplyScalar(0.65 + palette.lamps * 0.3)
    u.uOpacity.value = 0.11 + palette.lamps * 0.05
  }, -1)

  useEffect(() => () => { kit.g.dispose(); kit.mat.dispose(); kit.cover.dispose(); kit.cMat.dispose(); kit.base.dispose() }, [kit])

  return (
    <group>
      <mesh geometry={kit.g} material={kit.mat} frustumCulled={false} renderOrder={6} />
      {kit.vents.map((v, i) => (
        <mesh key={i} geometry={kit.cover} material={kit.cMat} position={[v.x, ((v as any).y ?? 0) + 0.03, v.z]} />
      ))}
    </group>
  )
}

/* ───────────────────────── dust ───────────────────────── */

const dustVert = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform vec3 uBox;
uniform float uSize;
varying float vA;
void main() {
  vec3 p = position + vec3(sin(uTime * 0.1 + aSeed * 10.0) * 0.5, uTime * 0.035 * (0.4 + aSeed), cos(uTime * 0.08 + aSeed * 7.0) * 0.5);
  vec3 rel = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = viewMatrix * vec4(rel + cameraPosition, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aSeed) / max(0.1, -mv.z) * 60.0;
  vA = smoothstep(0.2, 2.0, -mv.z) * (1.0 - smoothstep(10.0, 18.0, -mv.z)) * (0.35 + 0.65 * aSeed);
}
`
const dustFrag = /* glsl */ `
precision highp float;
varying float vA;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
}
`

export function Dust({ color = '#ffd9a8', opacity = 0.32, count = 520, box = [16, 9, 22] as [number, number, number] }) {
  const kit = useMemo(() => {
    const n = Math.round(count * rt.quality.particleScale)
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const r = rng(9)
    for (let i = 0; i < n; i++) {
      pos.set([r.range(-box[0] / 2, box[0] / 2), r.range(0, box[1]), r.range(-box[2] / 2, box[2] / 2)], i * 3)
      seed[i] = r()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uBox: { value: new THREE.Vector3(...box) }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uSize: { value: rt.touch ? 0.5 : 0.65 } },
    })
    return { g, mat }
  }, [color, opacity, count, box])
  useFrame(() => {
    kit.mat.uniforms.uTime.value = rt.time
    kit.mat.uniforms.uColor.value.copy(palette.sun).lerp(new THREE.Color('#ffffff'), 0.35)
    kit.mat.uniforms.uOpacity.value = opacity * (0.5 + palette.lamps * 0.5)
  }, -1)
  useEffect(() => () => { kit.g.dispose(); kit.mat.dispose() }, [kit])
  return <points geometry={kit.g} material={kit.mat} frustumCulled={false} renderOrder={7} />
}

/* ───────────────────────── cables ───────────────────────── */

export function Cables() {
  const kit = useMemo(() => {
    const r = rng(303)
    const mat = patchSway(new THREE.MeshBasicMaterial({ color: '#08080a' }), 0.06)
    const geos: THREE.BufferGeometry[] = []
    for (let i = 0; i < 12; i++) {
      const z = r.range(10, -70)
      const y0 = r.range(6.5, 15)
      const y1 = y0 + r.range(-1.2, 1.2)
      const xl = wallX(-1, z) + 0.15, xr = wallX(1, z) - 0.15
      const z2 = z + r.range(-4, 4)
      const sag = r.range(0.4, 1.4)
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 12; k++) {
        const t = k / 12
        pts.push(new THREE.Vector3(xl + (xr - xl) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * sag, z + (z2 - z) * t))
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.013, 4, false))
    }
    return { mat, geos }
  }, [])
  useFrame(() => {
    const u = (kit.mat.userData as any).sw as THREE.IUniform | undefined
    if (u) u.value = rt.time
  })
  useEffect(() => () => { kit.mat.dispose(); kit.geos.forEach((g) => g.dispose()) }, [kit])
  return (
    <group>
      {kit.geos.map((g, i) => (
        <mesh key={i} geometry={g} material={kit.mat} />
      ))}
    </group>
  )
}
