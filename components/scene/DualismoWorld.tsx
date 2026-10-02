'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { dualismo } from '@/data/project'
import { rng, smoothstep } from '@/lib/math'
import { rt } from '@/lib/runtime'
import { WORLD } from '@/lib/timeline'
import { useStore } from '@/lib/store'
import { exitDualism } from '@/lib/actions'
import { createArtworkMaterial } from './ArtworkMaterial'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { palette } from '@/lib/timeOfDay'

const D = WORLD.dualismX

/* ───────────────────────── particles ───────────────────────── */

const pVert = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform vec3 uMouse;
uniform float uSize;
uniform float uArrive;
varying float vA;
varying vec3 vC;
void main() {
  vec3 p = position;
  float t = uTime * 0.12;
  p += vec3(sin(t + aSeed * 40.0), cos(t * 1.3 + aSeed * 23.0), sin(t * 0.7 + aSeed * 11.0)) * 0.9;
  p *= 0.35 + 0.65 * uArrive;
  // pointer repels
  vec3 d = p - uMouse;
  float dist = length(d);
  p += normalize(d + 1e-4) * smoothstep(3.2, 0.0, dist) * 1.8;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.4 + aSeed) * 120.0 / max(0.5, -mv.z);
  vA = (0.25 + 0.75 * aSeed) * smoothstep(0.0, 6.0, -mv.z) * (0.6 + 0.4 * sin(uTime + aSeed * 90.0));
  vC = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + aSeed * 0.6 + uTime * 0.02));
}
`
const pFrag = /* glsl */ `
precision highp float;
varying float vA;
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.35), a * a * vA * 0.7);
}
`

function Particles() {
  const camera = useThree((s) => s.camera)
  const kit = useMemo(() => {
    const n = Math.round(1100 * rt.quality.particleScale)
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const r = rng(42)
    for (let i = 0; i < n; i++) {
      const rad = 3 + Math.pow(r(), 0.7) * 16
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1)
      pos.set([D + rad * Math.sin(ph) * Math.cos(th), rad * Math.sin(ph) * Math.sin(th) * 0.7, rad * Math.cos(ph) * 0.8 - 2], i * 3)
      seed[i] = r()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: pVert,
      fragmentShader: pFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(D, 0, 0) }, uSize: { value: rt.touch ? 0.7 : 1 }, uArrive: { value: 0 } },
    })
    return { g, mat, ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3() }
  }, [])
  useFrame(() => {
    const u = kit.mat.uniforms
    u.uTime.value = rt.time
    u.uArrive.value = rt.dual.t
    kit.ray.setFromCamera(new THREE.Vector2(rt.rx, rt.ry), camera)
    if (kit.ray.ray.intersectPlane(kit.plane, kit.hit)) u.uMouse.value.lerp(kit.hit, 0.15)
  }, -0.5)
  useEffect(() => () => { kit.g.dispose(); kit.mat.dispose() }, [kit])
  return <points geometry={kit.g} material={kit.mat} frustumCulled={false} renderOrder={5} />
}

/** Very distant, very slow specks: scale cues far beyond the visible geometry (parallax comes from the camera drift). */
function FarDust() {
  const kit = useMemo(() => {
    const n = Math.round(700 * rt.quality.particleScale)
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const r = rng(77)
    for (let i = 0; i < n; i++) {
      pos.set([D + r.range(-140, 140), r.range(-40, 60), r.range(-30, -300)], i * 3)
      seed[i] = r()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(D + 9999, 0, 0) }, uSize: { value: 2.2 }, uArrive: { value: 0 } },
    })
    return { g, mat }
  }, [])
  useFrame(() => { kit.mat.uniforms.uTime.value = rt.time * 0.4; kit.mat.uniforms.uArrive.value = rt.dual.t }, -0.5)
  useEffect(() => () => { kit.g.dispose(); kit.mat.dispose() }, [kit])
  return <points geometry={kit.g} material={kit.mat} frustumCulled={false} renderOrder={5} />
}

/* ───────────────────────── tunnel rings ───────────────────────── */

const rVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }'
const rFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uSeed, uFade;
void main() {
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vUv.x * 2.0 + uSeed + uTime * 0.05));
  float a = (0.5 + 0.5 * sin(vUv.x * 40.0 + uTime * 0.6 + uSeed * 10.0)) * 0.55 + 0.1;
  gl_FragColor = vec4(irid, a * uFade * 0.45);
}
`

function TunnelRings() {
  const kit = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.012, 6, 96)
    const rings = Array.from({ length: 16 }, (_, i) => ({
      mat: new THREE.ShaderMaterial({ vertexShader: rVert, fragmentShader: rFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uSeed: { value: i * 0.13 }, uFade: { value: 0 } } }),
      z: -2 - i * 2.4,
    }))
    return { geo, rings }
  }, [])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    kit.rings.forEach((r, i) => {
      const m = refs.current[i]
      if (!m) return
      const t = rt.time * 0.5 + i * 0.4
      const flow = ((rt.time * 1.6 + i * 2.4) % 38.4)
      const z = -2 - flow + 4
      m.position.set(D, 0, z)
      const rad = 3.4 + Math.sin(i * 0.9) * 0.4 + (rt.fx.tunnel > 0 ? 0 : 0)
      m.scale.setScalar(rad * (1 + Math.max(0, -z - 18) * 0.015))
      m.rotation.z = t * 0.2
      r.mat.uniforms.uTime.value = rt.time
      r.mat.uniforms.uFade.value = smoothstep(0, 5, -z) * (1 - smoothstep(24, 36, -z)) * rt.dual.t
    })
  }, -0.5)
  useEffect(() => () => { kit.geo.dispose(); kit.rings.forEach((r) => r.mat.dispose()) }, [kit])
  return (
    <group>
      {kit.rings.map((r, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m }} geometry={kit.geo} material={r.mat} renderOrder={1} />
      ))}
    </group>
  )
}

/* ───────────────────────── the impossible hall ─────────────────────────
   ALTERCO is physical, dirty, tactile. DUALISMO is its opposite: symmetrical, translucent, iridescent, mirrored in every axis.
   A black-glass floor mirrors the whole hall, glass monoliths recede to infinity, crystals float in mirrored pairs,
   spectral light falls through haze. Nothing here is lit by the sun. */

const glassVert = /* glsl */ `
attribute float aPhase;
attribute vec3 aDim;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying float vH;
varying float vPh;
varying float vDist;
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec3 p = position * aDim;
  float spin = uTime * 0.12 * (0.4 + fract(aPhase * 7.0)) * (aDim.x < 0.8 ? 1.0 : 0.0);
  p.xz = rot(spin + aPhase) * p.xz;
  vec3 n = normal;
  n.xz = rot(spin + aPhase) * n.xz;
  vec4 w = instanceMatrix * vec4(p, 1.0);
  w.y += sin(uTime * 0.35 + aPhase * 30.0) * 0.25;
  vec4 mv = viewMatrix * modelMatrix * w;
  vN = normalize(mat3(viewMatrix * modelMatrix) * mat3(instanceMatrix) * n);
  vV = -mv.xyz;
  vH = w.y;
  vPh = aPhase;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`
const glassFrag = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vV;
varying float vH;
varying float vPh;
varying float vDist;
uniform float uTime;
uniform float uFade;
uniform float uOpacity;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float f = 1.0 - abs(dot(n, v));
  float ff = pow(f, 2.2);
  // thin-film: hue walks with view angle, height and time
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.3 + vH * 0.035 + vPh + uTime * 0.02));
  float band = 0.5 + 0.5 * sin(vH * 2.2 + uTime * 0.3 + vPh * 20.0);
  vec3 col = film * (0.25 + 1.4 * ff) + vec3(0.04, 0.06, 0.14);
  // far structures dissolve into spectral haze: the hall never visibly ends
  float far = 1.0 - smoothstep(70.0, 260.0, vDist);
  float a = (0.05 + 0.6 * ff + 0.06 * band) * uOpacity * uFade * (0.25 + 0.75 * far);
  col = mix(col, vec3(0.2, 0.26, 0.62), (1.0 - far) * 0.55);
  gl_FragColor = vec4(col * a * 1.6, a);
}
`

function GlassHall() {
  const kit = useMemo(() => {
    const t = rt.quality.tier
    const rows = t === 'high' ? 26 : t === 'medium' ? 18 : 12
    const crystals = t === 'high' ? 30 : t === 'medium' ? 18 : 10
    const r = rng(1313)
    const mat = new THREE.ShaderMaterial({
      vertexShader: glassVert, fragmentShader: glassFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uOpacity: { value: 0.75 } },
    })
    // slabs: strictly symmetric left/right pairs, same height & yaw mirrored
    const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, rows * 2)
    const dim = new Float32Array(rows * 2 * 3), ph = new Float32Array(rows * 2)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1)
    for (let i = 0; i < rows; i++) {
      const z = 7 - i * 7.2 * (1 + 0.03 * i)
      const w = (0.28 + r() * 0.12) * (1 + i * 0.03), h = r.range(8, 15) + i * 0.7, d = r.range(1.6, 3.0)
      const x = 6.2 + i * 0.3
      const yaw = r.range(0.12, 0.5)
      const phase = r()
      for (const sgn of [-1, 1]) {
        const k = i * 2 + (sgn > 0 ? 1 : 0)
        m4.compose(new THREE.Vector3(D + sgn * x, 0, z), q.setFromEuler(e.set(0, -sgn * yaw, 0)), sc)
        slabs.setMatrixAt(k, m4)
        dim.set([w, h, d], k * 3)
        ph[k] = phase + (sgn > 0 ? 0.0 : 0.0) // identical phase = identical motion on both sides (symmetry)
      }
    }
    slabs.geometry.setAttribute('aDim', new THREE.InstancedBufferAttribute(dim, 3))
    slabs.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1))
    slabs.frustumCulled = false
    slabs.renderOrder = 2
    // crystals: octahedra, every one with a mirrored twin
    const cr = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), mat, crystals * 2)
    const cd = new Float32Array(crystals * 2 * 3), cp = new Float32Array(crystals * 2)
    for (let i = 0; i < crystals; i++) {
      const z = r.range(-220, 6), x = r.range(1.8, 10 + (-z) * 0.08), y = r.range(0.4, 6.5 + (-z) * 0.05), s = r.range(0.25, 0.9) * (1 + (-z) / 55), phase = r()
      for (const sgn of [-1, 1]) {
        const k = i * 2 + (sgn > 0 ? 1 : 0)
        m4.compose(new THREE.Vector3(D + sgn * x, y * sgn, z), q.setFromEuler(e.set(0, 0, 0)), sc)
        cr.setMatrixAt(k, m4)
        cd.set([s * 0.9, s * 1.6, s * 0.9], k * 3)
        cp[k] = phase
      }
    }
    cr.geometry.setAttribute('aDim', new THREE.InstancedBufferAttribute(cd, 3))
    cr.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(cp, 1))
    cr.frustumCulled = false
    cr.renderOrder = 2
    return { mat, slabs, cr }
  }, [])
  useFrame(() => {
    const u = kit.mat.uniforms
    u.uTime.value = rt.time
    u.uFade.value = rt.dual.t
    kit.slabs.visible = kit.cr.visible = rt.world === 'dualism'
  }, -0.5)
  useEffect(() => () => { kit.slabs.geometry.dispose(); kit.cr.geometry.dispose(); kit.slabs.dispose(); kit.cr.dispose(); kit.mat.dispose() }, [kit])
  return (
    <group>
      <primitive object={kit.slabs} />
      <primitive object={kit.cr} />
    </group>
  )
}

/** Black-glass floor: the world above is mirrored below. Thin-film sheen creeps in at grazing angles. */
function MirrorFloor() {
  const tier = rt.quality.tier
  const real = rt.quality.reflector && tier !== 'low'
  const kit = useMemo(() => {
    const geo = new THREE.PlaneGeometry(160, 260)
    const shader = {
      name: 'DualFloor',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 }, uFade: { value: 0 } },
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW; void main(){ vUv = textureMatrix*vec4(position,1.0); vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade;
        varying vec4 vUv; varying vec3 vW;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float f = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
          vec2 uv = vUv.xy / vUv.w;
          uv += vec2(sin(vW.z * 0.9 + uTime * 0.4), cos(vW.x * 0.7 - uTime * 0.3)) * 0.0015;
          float b = 0.004;
          vec3 c = texture2D(tDiffuse, uv).rgb * 0.5 + texture2D(tDiffuse, uv + vec2(b, 0.0)).rgb * 0.25 + texture2D(tDiffuse, uv - vec2(b, 0.0)).rgb * 0.25;
          vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.2 + vW.z * 0.01 + uTime * 0.02));
          c = c * (0.55 + 0.45 * (1.0 - f)) + film * f * 0.12;
          // the floor fades into the haze with distance so the horizon is not a line
          float dist = length(vW.xz - cameraPosition.xz);
          float fade = 1.0 - smoothstep(40.0, 260.0, dist);
          gl_FragColor = vec4(c * 0.95, (0.55 + 0.4 * f) * fade * uFade);
        }`,
    }
    let obj: THREE.Mesh
    let mat: THREE.ShaderMaterial
    if (real) {
      const rf = new Reflector(geo, { color: new THREE.Color(0.9, 0.95, 1), textureWidth: rt.quality.reflectorRes, textureHeight: Math.round(rt.quality.reflectorRes * 0.62), clipBias: 0.003, multisample: rt.quality.tier === 'high' ? 2 : 0, shader })
      mat = rf.material as THREE.ShaderMaterial
      obj = rf
    } else {
      mat = new THREE.ShaderMaterial({
        vertexShader: shader.vertexShader.replace('vUv = textureMatrix*vec4(position,1.0);', 'vUv = vec4(0.0);'),
        fragmentShader: `uniform float uTime; uniform float uFade; varying vec4 vUv; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - clamp(V.y,0.0,1.0), 3.0); vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.2 + vW.z * 0.01 + uTime * 0.02)); gl_FragColor = vec4(vec3(0.02,0.03,0.08) + film * f * 0.18, 0.8 * uFade); }`,
        uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
      })
      obj = new THREE.Mesh(geo, mat)
    }
    mat.transparent = true
    mat.depthWrite = false
    obj.rotation.x = -Math.PI / 2
    obj.position.set(D, -2.6, -60)
    obj.renderOrder = 1
    return { obj, mat, geo }
  }, [real])
  useFrame(() => {
    kit.mat.uniforms.uTime.value = rt.time
    kit.mat.uniforms.uFade.value = rt.dual.t
    kit.obj.visible = rt.world === 'dualism'
  }, -0.5)
  useEffect(() => () => { ;(kit.obj as any).dispose?.(); kit.geo.dispose(); kit.mat.dispose() }, [kit])
  return <primitive object={kit.obj} />
}

/** Spectral light falling through haze + drifting haze sheets (depth, not fog on a wall). */
function SpectralAir() {
  const kit = useMemo(() => {
    const vert = 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }'
    const shaft = new THREE.ShaderMaterial({
      vertexShader: vert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uHue: { value: 0 } },
      fragmentShader: `
        varying vec2 vUv; varying vec3 vW; uniform float uTime, uFade, uHue;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float across = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.0);
          float along = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
          float st = 0.5 + 0.5 * n(vec2(vUv.x * 7.0 + uHue * 9.0, vUv.y * 1.4 - uTime * 0.05));
          vec3 c = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + uHue + vUv.y * 0.35 + uTime * 0.01));
          float near = smoothstep(2.0, 9.0, distance(cameraPosition, vW));
          float a = across * along * st * near * uFade * 0.14;
          gl_FragColor = vec4(c * a, a);
        }`,
    })
    const haze = new THREE.ShaderMaterial({
      vertexShader: vert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
      fragmentShader: `
        varying vec2 vUv; varying vec3 vW; uniform float uTime, uFade;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = vUv * vec2(3.0, 2.0) + vec2(uTime * 0.01 + vW.z * 0.3, vW.z * 0.7);
          float d = (n(p) * 0.6 + n(p * 2.1 + 5.0) * 0.4);
          float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
          float near = smoothstep(3.0, 12.0, distance(cameraPosition, vW));
          vec3 c = mix(vec3(0.16, 0.2, 0.5), vec3(0.45, 0.25, 0.6), n(p * 0.7));
          float a = smoothstep(0.25, 0.8, d) * edge * near * uFade * 0.12;
          gl_FragColor = vec4(c * a, a);
        }`,
    })
    const geo = new THREE.PlaneGeometry(1, 1)
    const shafts = Array.from({ length: 9 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (2.2 + (i % 5) * 1.5), z: -4 - i * 9, w: 2.0 + (i % 3), h: 22, hue: i / 9 }))
    const sheets = Array.from({ length: 12 }, (_, i) => ({ z: 4 - i * 17 - (i % 2) * 4, w: 40 + i * 6, h: 18 + i * 2 }))
    return { shaft, haze, geo, shafts, sheets }
  }, [])
  useFrame(() => {
    const t = rt.time
    kit.shaft.uniforms.uTime.value = t
    kit.shaft.uniforms.uFade.value = rt.dual.t
    kit.haze.uniforms.uTime.value = t
    kit.haze.uniforms.uFade.value = rt.dual.t
  }, -0.5)
  useEffect(() => () => { kit.shaft.dispose(); kit.haze.dispose(); kit.geo.dispose() }, [kit])
  return (
    <group>
      {kit.shafts.map((s, i) => (
        <group key={'s' + i} position={[D + s.x, 4, s.z]}>
          <ShaftMesh geo={kit.geo} base={kit.shaft} hue={s.hue} w={s.w} h={s.h} />
          <ShaftMesh geo={kit.geo} base={kit.shaft} hue={s.hue} w={s.w} h={s.h} rotY={Math.PI / 2} />
        </group>
      ))}
      {kit.sheets.map((s, i) => (
        <mesh key={'h' + i} geometry={kit.geo} material={kit.haze} position={[D, 3, s.z]} scale={[s.w, s.h, 1]} renderOrder={3} />
      ))}
    </group>
  )
}
function ShaftMesh({ geo, base, hue, w, h, rotY = 0 }: { geo: THREE.BufferGeometry; base: THREE.ShaderMaterial; hue: number; w: number; h: number; rotY?: number }) {
  const mat = useMemo(() => {
    const m = base.clone()
    m.uniforms = { uTime: base.uniforms.uTime, uFade: base.uniforms.uFade, uHue: { value: hue } }
    return m
  }, [base, hue])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={geo} material={mat} scale={[w, h, 1]} rotation={[0, rotY, 0]} renderOrder={3} />
}

/** Distortion halo around the official artwork: counter-rotating spectral arcs, never touching the artwork itself. */
function LensHalo() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uDir: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `
          varying vec2 vUv; uniform float uTime, uFade, uDir;
          void main(){
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p), a = atan(p.y, p.x) * uDir;
            float wob = sin(a * 5.0 + uTime * 0.5) * 0.02 + sin(a * 11.0 - uTime * 0.7) * 0.008;
            float ring = 0.0;
            for (int i = 0; i < 4; i++) { float fi = float(i); float rr = 0.52 + fi * 0.11 + wob * (1.0 + fi); ring += smoothstep(0.006, 0.0, abs(r - rr)) * (0.45 - fi * 0.08) * (0.5 + 0.5 * sin(a * (3.0 + fi) + uTime * (0.3 + fi * 0.15))); }
            vec3 c = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + a * 0.16 + r * 1.5 + uTime * 0.03));
            float glow = smoothstep(0.98, 0.5, r) * smoothstep(0.4, 0.62, r) * 0.22;
            gl_FragColor = vec4(c * (ring + glow) * uFade, (ring + glow) * uFade);
          }`,
      }),
    [],
  )
  const mat2 = useMemo(() => { const m = mat.clone(); m.uniforms = { uTime: mat.uniforms.uTime, uFade: mat.uniforms.uFade, uDir: { value: -1 } }; return m }, [mat])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    mat.uniforms.uTime.value = rt.time
    mat.uniforms.uFade.value = rt.dual.t
    if (g.current) { g.current.visible = rt.world === 'dualism'; g.current.rotation.z = rt.time * 0.03 }
  }, -0.4)
  useEffect(() => () => { mat.dispose(); mat2.dispose(); geo.dispose() }, [mat, mat2, geo])
  return (
    <group ref={g} position={[D, 0.1, -0.05]}>
      <mesh geometry={geo} material={mat} scale={[9.5, 9.5, 1]} renderOrder={4} />
      <mesh geometry={geo} material={mat2} scale={[12.5, 12.5, 1]} rotation={[0, 0, 0.6]} renderOrder={4} />
    </group>
  )
}

/* ───────────────────────── track orbiters ───────────────────────── */

function Orbiter({ index }: { index: number }) {
  const g = useRef<THREE.Group>(null)
  const ringTex = A.dualLabels[index]
  const discMat = useMemo(() => {
    const m = createArtworkMaterial(A.covers.dualismo)
    m.uniforms.uFlow.value = 0.6
    return m
  }, [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, side: THREE.DoubleSide }), [ringTex])
  const discGeo = useMemo(() => new THREE.CircleGeometry(0.72, 48), [])
  const ringGeo = useMemo(() => new THREE.PlaneGeometry(2.7, 2.7), [])
  const hov = useRef(0)
  const flag = useRef(false)
  useEffect(() => () => { discMat.dispose(); ringMat.dispose(); discGeo.dispose(); ringGeo.dispose() }, [discMat, ringMat, discGeo, ringGeo])

  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    const st = useStore.getState()
    const sel = st.dualismoTrack === index
    hov.current += ((flag.current || sel ? 1 : 0) - hov.current) * Math.min(1, dt * 6)
    // two opposing poles on one point-symmetric orbit: when one is near, left, high and lit, the other is far, right, low and dark
    const t = rt.time * 0.16 + index * Math.PI
    const arrive = rt.dual.t
    const R = (4.4 + Math.sin(rt.time * 0.4 + index) * 0.15) * (0.3 + 0.7 * arrive)
    const x = -Math.cos(t) * R
    const z = Math.sin(t) * R * 1.35 - 1.0
    const y = 0.4 * Math.cos(t * 2.0) * (index === 0 ? 1 : -1) + (index === 0 ? 0.8 : -0.8) * (0.5 + 0.5 * Math.cos(t))
    o.position.set(D + x, y, z)
    // nearer = larger: depth is part of the opposition (near/far)
    const near = 0.8 + 0.3 * (z + 5) / 10
    const s = (1 + hov.current * 0.28 + (sel ? 0.15 : 0)) * smoothstep(0, 0.5, arrive) * near
    o.scale.setScalar(s)
    o.lookAt(D, 0.2, 14) // face the viewer's side
    discMat.uniforms.uTime.value = rt.time
    discMat.uniforms.uSplit.value = 0.002 + hov.current * 0.012
    // positive / negative: Chirone burns bright, Messaggio is a dark mirror image of the same idea
    discMat.uniforms.uGlow.value = hov.current + (index === 0 ? 0.55 : -0.25)
    discMat.uniforms.uReveal.value = 1
    ringMat.opacity = 0.55 + hov.current * 0.45
    ringMat.map!.rotation = 0
    const ring = o.children[1] as THREE.Mesh
    ring.rotation.z = rt.time * 0.25 * (index === 0 ? 1 : -1)
    o.visible = arrive > 0.02 && rt.world === 'dualism'
  }, -0.4)

  return (
    <group ref={g}>
      <mesh
        geometry={discGeo}
        material={discMat}
        onPointerOver={(e) => { e.stopPropagation(); flag.current = true; useStore.getState().setCursor('track', 'OPEN') }}
        onPointerOut={() => { flag.current = false; useStore.getState().setCursor('default') }}
        onClick={(e) => { e.stopPropagation(); const s = useStore.getState(); s.set({ dualismoTrack: s.dualismoTrack === index ? null : index }) }}
      />
      <mesh geometry={ringGeo} material={ringMat} position={[0, 0, -0.02]} />
    </group>
  )
}

/* ───────────────────────── central artwork + return rift ───────────────────────── */

function Centerpiece() {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => createArtworkMaterial(A.covers.dualismo), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, 24, 24), [])
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: A.glow, color: '#7fb0ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false }), [])
  useEffect(() => () => { mat.dispose(); geo.dispose(); halo.dispose() }, [mat, geo, halo])
  useFrame(() => {
    const o = g.current
    if (!o) return
    const u = mat.uniforms
    const arrive = rt.dual.t
    u.uTime.value = rt.time
    u.uReveal.value = smoothstep(0, 0.7, arrive)
    u.uFlow.value = 0.5
    u.uSplit.value = 0.003 + 0.002 * Math.sin(rt.time * 0.7)
    u.uBulge.value = 4
    u.uGlow.value = 0.5
    u.uTilt.value.set(rt.px, rt.py)
    // breathing: extremely subtle
    const b = 1 + Math.sin(rt.time * 0.9) * 0.012
    const s = 3.3 * b
    o.scale.set(s, s, 1)
    o.position.set(D, 0.1 + Math.sin(rt.time * 0.5) * 0.05, 0)
    o.rotation.set(-rt.py * 0.06, rt.px * 0.1, 0)
    halo.opacity = 0.35 * arrive + 0.1 * Math.sin(rt.time * 0.9)
    o.visible = rt.world === 'dualism'
  }, -0.4)
  return (
    <group ref={g}>
      <mesh geometry={geo} material={mat} />
      <sprite material={halo} scale={[3.2, 3.2, 1]} position={[0, 0, -0.2]} />
    </group>
  )
}

function ReturnRift() {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: A.returnLabel, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, side: THREE.DoubleSide }), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(2.4, 2.4), [])
  const core = useMemo(() => new THREE.SpriteMaterial({ map: A.glow, color: '#ffb27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, fog: false }), [])
  const hov = useRef(0)
  const flag = useRef(false)
  useEffect(() => () => { mat.dispose(); geo.dispose(); core.dispose() }, [mat, geo, core])
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    hov.current += ((flag.current ? 1 : 0) - hov.current) * Math.min(1, dt * 7)
    o.position.set(D - 4.3, -2.3 + Math.sin(rt.time * 0.6) * 0.1, 3.2)
    o.scale.setScalar((0.85 + hov.current * 0.3) * smoothstep(0.3, 1, rt.dual.t))
    ;(o.children[0] as THREE.Mesh).rotation.z = rt.time * 0.18
    mat.opacity = 0.45 + hov.current * 0.55
    core.opacity = 0.35 + hov.current * 0.5
    o.visible = rt.world === 'dualism'
  }, -0.4)
  return (
    <group ref={g}>
      <mesh
        geometry={geo}
        material={mat}
        onPointerOver={(e) => { e.stopPropagation(); flag.current = true; useStore.getState().setCursor('portal', 'RETURN') }}
        onPointerOut={() => { flag.current = false; useStore.getState().setCursor('default') }}
        onClick={(e) => { e.stopPropagation(); exitDualism() }}
      />
      <sprite material={core} scale={[1.6, 1.6, 1]} />
    </group>
  )
}

export function DualismoWorld() {
  return (
    <group>
      <MirrorFloor />
      <GlassHall />
      <FarDust />
      <SpectralAir />
      <LensHalo />
      <TunnelRings />
      <Centerpiece />
      {dualismo.tracks.map((t, i) => (
        <Orbiter key={t.id} index={i} />
      ))}
      <ReturnRift />
      <Particles />
    </group>
  )
}
