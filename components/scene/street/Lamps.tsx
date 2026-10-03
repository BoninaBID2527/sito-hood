'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { GeoBuilder } from '@/lib/geo'
import { rt } from '@/lib/runtime'
import { palette } from '@/lib/timeOfDay'
import { useStore } from '@/lib/store'
import { rng, smoothstep } from '@/lib/math'
import { streetMat } from './materials'

export interface LampDef {
  id: number
  x: number
  z: number
  /** direction of the arm, -1 = arm points toward −x */
  arm: -1 | 1
  flicker?: boolean
}

export const LAMPS: LampDef[] = [
  { id: 0, x: -2.45, z: -4, arm: 1 },
  { id: 1, x: 2.55, z: -21, arm: -1 },
  { id: 2, x: -2.5, z: -36, arm: 1, flicker: true },
  { id: 3, x: 2.45, z: -50, arm: -1 },
  { id: 4, x: -3.2, z: -66, arm: 1 },
  { id: 5, x: 6.5, z: -84, arm: -1 },
  { id: 6, x: -6.5, z: -92, arm: 1 },
  { id: 7, x: 6.5, z: -108, arm: -1 },
]
const HEIGHT = 4.7

function buildLampGeo() {
  const b = new GeoBuilder()
  b.cyl(0.07, 0.1, HEIGHT, 0, HEIGHT / 2, 0, 10)
  b.cyl(0.16, 0.2, 0.5, 0, 0.25, 0, 10)
  b.cyl(0.11, 0.11, 0.1, 0, 0.55, 0, 10)
  // curved arm toward +x
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, HEIGHT - 0.1, 0), new THREE.Vector3(0.05, HEIGHT + 0.7, 0), new THREE.Vector3(0.95, HEIGHT + 0.55, 0))
  b.add(new THREE.TubeGeometry(curve, 14, 0.04, 6, false))
  // head / shade
  b.add(new THREE.ConeGeometry(0.3, 0.2, 14, 1, true), 0.98, HEIGHT + 0.5, 0)
  b.cyl(0.05, 0.05, 0.1, 0.98, HEIGHT + 0.62, 0, 8)
  return b.build()
}

export function Lamps() {
  const kit = useMemo(() => {
    const geo = buildLampGeo()
    const metal = streetMat({ color: '#18181a', roughness: 0.5, metalness: 0.6, aoBase: 0.7 })
    const bulbGeo = new THREE.SphereGeometry(0.11, 12, 8)
    const hitGeo = new THREE.BoxGeometry(1.4, HEIGHT + 1, 1.2)
    const glowMat = (c: string) => new THREE.SpriteMaterial({ map: A.glow, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })
    // light shaft cone (open, additive)
    const coneGeo = new THREE.ConeGeometry(1.7, HEIGHT - 0.2, 20, 1, true)
    coneGeo.translate(0, -(HEIGHT - 0.2) / 2, 0)
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uI: { value: 0 }, uC: { value: new THREE.Color('#ffc880') } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vN = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uI; uniform vec3 uC; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float h = smoothstep(-4.5, 0.0, vY); gl_FragColor = vec4(uC, uI * f * h * 0.1); }',
    })
    return { geo, metal, bulbGeo, hitGeo, glowMat, coneGeo, coneMat }
  }, [])

  const lights = useRef<THREE.PointLight[]>([])
  const bulbs = useRef<(THREE.Mesh | null)[]>([])
  const glows = useRef<(THREE.Sprite | null)[]>([])
  const cones = useRef<(THREE.Mesh | null)[]>([])
  const levels = useRef<number[]>(LAMPS.map(() => 1))
  const flick = useMemo(() => LAMPS.map((l) => rng(l.id + 3)), [])
  const lampOn = useRef(true)
  const lastToggle = useRef(-10)
  const order = useRef<number[]>([])

  const bulbMats = useMemo(() => LAMPS.map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.6, 2.6) })), [])
  const glowMats = useMemo(() => LAMPS.map(() => kit.glowMat('#ffb868')), [kit])
  const coneMats = useMemo(() => LAMPS.map(() => kit.coneMat.clone()), [kit])
  // after DUALISMO: lamp 3 occasionally splits into two spectral halves; lamp 7 answers the pointer with the wrong colour
  const splitMats = useMemo(() => ['#ff2a40', '#2a8aff'].map((c) => kit.glowMat(c)), [kit])
  const splitRefs = useRef<(THREE.Sprite | null)[]>([])
  const baseCol = useMemo(() => new THREE.Color('#ffb868'), [])

  useEffect(() => {
    const unsub = useStore.subscribe((s, p) => {
      if (s.lamp !== p.lamp) {
        lampOn.current = s.lamp
        lastToggle.current = rt.time
      }
    })
    return () => {
      unsub()
      kit.geo.dispose(); kit.metal.dispose(); kit.bulbGeo.dispose(); kit.hitGeo.dispose(); kit.coneGeo.dispose(); kit.coneMat.dispose()
      bulbMats.forEach((m) => m.dispose()); glowMats.forEach((m) => m.dispose()); coneMats.forEach((m) => m.dispose()); splitMats.forEach((m) => m.dispose())
    }
  }, [kit, bulbMats, glowMats, coneMats, splitMats])

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, dt) => {
    // per-lamp brightness (flicker, egg toggle, time of day)
    LAMPS.forEach((l, i) => {
      let v = palette.lamps
      if (l.flicker) {
        const t = rt.time
        const n = Math.sin(t * 23.0) * Math.sin(t * 7.3) + Math.sin(t * 41.0 + 2.0) * 0.4
        v *= n > 0.92 ? 0.25 : n > 0.7 ? 0.7 : 1
      }
      if (l.id === 0) {
        const since = rt.time - lastToggle.current
        const target = lampOn.current ? 1 : 0
        const fl = since < 0.5 ? (Math.sin(since * 70) > 0 ? 1 : 0.3) : 1
        levels.current[i] += (target - levels.current[i]) * Math.min(1, dt * 14)
        v *= levels.current[i] * (target ? fl : 1)
      }
      levels.current[i + 0] = l.id === 0 ? levels.current[i] : v
      const vis = l.id === 0 ? v : v
      bulbMats[i].color.setRGB(6 * vis, 4.6 * vis, 2.6 * vis)
      glowMats[i].opacity = Math.min(1, vis * 0.9)
      coneMats[i].uniforms.uI.value = vis * (1 - rt.fx.dualism)
      ;(l as any)._v = vis
    })
    const mem = useStore.getState().dualReturned
    {
      const t = rt.time
      const sp = mem ? Math.max(0, Math.sin(t * 0.41) * Math.sin(t * 0.13 + 1) - 0.7) * 3.2 : 0
      const base = glowMats[3].opacity
      splitMats[0].opacity = Math.min(1, sp) * 0.6 * base
      splitMats[1].opacity = Math.min(1, sp) * 0.6 * base
      const off = 0.22 + sp * 0.5
      if (splitRefs.current[0]) splitRefs.current[0]!.position.x = 0.98 - off
      if (splitRefs.current[1]) splitRefs.current[1]!.position.x = 0.98 + off
      if (mem) {
        // a distant lamp whose colour depends on where you are looking — warm when you are not
        const k = smoothstep(0.12, 0.7, Math.abs(rt.px)) * 0.8
        glowMats[7].color.copy(baseCol).lerp(_cool, k)
      } else glowMats[7].color.copy(baseCol)
    }
    // pool: three real lights hop to the nearest lamps (intensity depends only on distance → no popping)
    order.current = LAMPS.map((_, i) => i).sort((a, b) => dist(camera.position, a) - dist(camera.position, b))
    for (let k = 0; k < lights.current.length; k++) {
      const L = lights.current[k]
      const idx = order.current[k]
      const lamp = LAMPS[idx]
      const d = dist(camera.position, idx)
      const f = 1 - smoothstep(14, 34, d)
      L.position.set(lamp.x + lamp.arm * 0.98, HEIGHT + 0.35, lamp.z)
      L.intensity = ((lamp as any)._v ?? 1) * f * 85
      L.color.set('#ffb36b')
    }
    void tmp
  }, -1)

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <pointLight key={i} ref={(r) => { if (r) lights.current[i] = r }} distance={30} decay={2} intensity={0} />
      ))}
      {LAMPS.map((l, i) => (
        <group key={l.id} position={[l.x, 0, l.z]} scale={[l.arm, 1, 1]}>
          <mesh geometry={kit.geo} material={kit.metal} />
          <mesh ref={(r) => { bulbs.current[i] = r }} geometry={kit.bulbGeo} material={bulbMats[i]} position={[0.98, HEIGHT + 0.42, 0]} />
          <sprite ref={(r) => { glows.current[i] = r }} material={glowMats[i]} position={[0.98, HEIGHT + 0.42, 0]} scale={[3.2, 3.2, 1]} />
          <mesh ref={(r) => { cones.current[i] = r }} geometry={kit.coneGeo} material={coneMats[i]} position={[0.98, HEIGHT + 0.4, 0]} renderOrder={3} />
          {l.id === 3 && [0, 1].map((k) => (
            <sprite key={k} ref={(r) => { splitRefs.current[k] = r }} material={splitMats[k]} position={[0.98, HEIGHT + 0.42, 0]} scale={[2.4, 2.4, 1]} />
          ))}
          {l.id === 0 && (
            <mesh
              position={[0.5, (HEIGHT + 1) / 2, 0]}
              geometry={kit.hitGeo}
              onClick={(e) => {
                e.stopPropagation()
                const s = useStore.getState()
                s.set({ lamp: !s.lamp })
                s.markEgg('lamp')
                rt.impulse.glitch = 0.4
                if (s.lamp) s.say('LIGHTS OUT', 'Click again.')
              }}
              onPointerOver={(e) => { e.stopPropagation(); useStore.getState().setCursor('lamp', 'LIGHT') }}
              onPointerOut={() => useStore.getState().setCursor('default')}
            >
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

const _cool = new THREE.Color('#78a8ff')

function dist(p: THREE.Vector3, i: number) {
  const l = LAMPS[i]
  return Math.hypot(p.x - l.x, p.z - l.z)
}
