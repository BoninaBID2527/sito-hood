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
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.35), a * a * vA);
}
`

function Particles() {
  const camera = useThree((s) => s.camera)
  const kit = useMemo(() => {
    const n = Math.round(2400 * rt.quality.particleScale)
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

/* ───────────────────────── tunnel rings ───────────────────────── */

const rVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }'
const rFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uSeed, uFade;
void main() {
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vUv.x * 2.0 + uSeed + uTime * 0.05));
  float a = (0.5 + 0.5 * sin(vUv.x * 40.0 + uTime * 0.6 + uSeed * 10.0)) * 0.55 + 0.1;
  gl_FragColor = vec4(irid, a * uFade);
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
    const t = rt.time * 0.28 + index * Math.PI
    const arrive = rt.dual.t
    const R = (3.6 + Math.sin(rt.time * 0.4 + index) * 0.15) * (0.3 + 0.7 * arrive)
    const tilt = index === 0 ? 0.35 : -0.35
    const x = Math.cos(t) * R
    const z = Math.sin(t) * R * 0.7
    const y = Math.sin(t) * R * Math.sin(tilt) + (index === 0 ? 0.5 : -0.5)
    o.position.set(D + x, y, z)
    const s = (1 + hov.current * 0.28 + (sel ? 0.15 : 0)) * smoothstep(0, 0.5, arrive)
    o.scale.setScalar(s)
    o.lookAt(D, 0.2, 14) // face the viewer's side
    discMat.uniforms.uTime.value = rt.time
    discMat.uniforms.uSplit.value = 0.002 + hov.current * 0.012
    discMat.uniforms.uGlow.value = hov.current
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
