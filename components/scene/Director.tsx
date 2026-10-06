'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { applyScrub, buildParamTimeline, sampleCamera, WORLD, type CamSample } from '@/lib/timeline'
import { evalTimeOfDay } from '@/lib/timeOfDay'
import { bump, clamp, damp, smoothstep, stepSpring, type Spring } from '@/lib/math'
import { rig, stepRig } from '@/lib/trackRig'
import { room, stepRoom } from '@/lib/room'

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _upY = new THREE.Vector3(0, 1, 0)
const _up2 = new THREE.Vector3()

/**
 * The one place that owns time. Every frame it:
 *  1. smooths pointer + scroll (spring with a hint of overshoot → "mass")
 *  2. scrubs the GSAP parameter timeline with the smoothed progress
 *  3. evaluates time-of-day
 *  4. drives the camera: spline path + pointer parallax + breathing + transition kicks
 */
export function Director() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const tl = useMemo(() => buildParamTimeline(), [])
  const spring = useRef<Spring>({ x: 0, v: 0 })
  const sample = useRef<CamSample>({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50, roll: 0, world: 'alley' })
  const lastFov = useRef(0)
  const look = useRef(new THREE.Vector3())

  useEffect(() => {
    rt.aspect = size.width / size.height
    rt.width = size.width
    rt.height = size.height
  }, [size])

  useEffect(() => () => void tl.kill(), [tl])

  useFrame((_, dtRaw) => {
    rt.frameT0 = performance.now()
    const dt = Math.min(dtRaw, 0.05)
    rt.time += dt
    const store = useStore.getState()
    const mode = store.mode
    const frozen = mode === 'dualism' || mode === 'dualism-out'
    const S = rt.reducedMotion ? 0 : rt.touch ? 0.4 : 1

    // ── pointer: weighted + slightly delayed (never 1:1)
    rt.px = damp(rt.px, clamp(rt.rx + rt.tx, -1, 1), 3.0, dt)
    rt.py = damp(rt.py, clamp(rt.ry + rt.ty, -1, 1), 3.0, dt)

    // ── scroll: under-damped spring on top of Lenis' smoothing
    if (rt.snapSpring !== null && Math.abs(rt.progress - rt.snapSpring) < 0.003) { spring.current.x = rt.progress; spring.current.v = 0; rt.snapSpring = null }
    const prev = spring.current.x
    if (!frozen) {
      if (rt.reducedMotion) spring.current.x = damp(spring.current.x, rt.progress, 7, dt)
      else {
        stepSpring(spring.current, rt.progress, 26, 8.4, dt)
      }
    }
    rt.smooth = spring.current.x
    const rawV = (spring.current.x - prev) / Math.max(dt, 1e-4)
    rt.velocity = damp(rt.velocity, frozen ? 0 : rawV, 14, dt)
    rt.idle = Math.abs(rt.velocity) > 0.004 ? 0 : rt.idle + dt
    const p = clamp(rt.smooth)

    // ── evaluate the story at p
    evalTimeOfDay(p)
    applyScrub(tl, p)

    // world selection
    const cs = sampleCamera(p, sample.current)
    rt.world = mode === 'dualism' || mode === 'dualism-out' ? 'dualism' : room.inside ? 'room' : cs.world
    stepRig(dt)
    stepRoom(dt)

    // ── camera
    const cam = camera
    let fov = cs.fov
    if (rt.world === 'dualism') {
      const d = rt.dual.t
      const t = rt.time
      const D = WORLD.dualismX
      const kick = S * 1.6
      cam.position.set(D + Math.sin(t * 0.11) * 1.1 + rt.px * 0.9 * kick, 0.3 + Math.sin(t * 0.15) * 0.25 + rt.py * 0.5 * kick, 9.5 + (1 - d) * 7)
      look.current.set(D + rt.px * 0.3, 0.1, 0)
      cam.lookAt(look.current)
      fov = 52 + (1 - d) * 16
    } else if (rt.world === 'room') {
      // THE HOODDINO ROOM: authored stations, no free camera — the pointer only breathes a little parallax into the shot
      cam.position.copy(room.cpos)
      look.current.copy(room.clook)
      fov = room.fov
      cam.lookAt(look.current)
      cam.updateMatrixWorld()
      _right.setFromMatrixColumn(cam.matrixWorld, 0)
      _up.setFromMatrixColumn(cam.matrixWorld, 1)
      const k = S * (1 - room.push * 0.75)
      cam.position.addScaledVector(_right, rt.px * 0.1 * k)
      cam.position.addScaledVector(_up, rt.py * 0.045 * k)
      cam.lookAt(look.current)
      cam.rotateY(-rt.px * 0.012 * k)
      cam.rotateX(rt.py * 0.008 * k)
    } else {
      cam.position.copy(cs.pos)
      look.current.copy(cs.look)

      // the track installation: the camera walks the rig (entry → 01 … 07 → exit); the rig owns the pose while it is active
      if (rig.w > 0.001) {
        cam.position.lerp(rig.pos, rig.w)
        look.current.lerp(rig.look, rig.w)
        fov += rig.fov
      }

      // the visitor walks to the studio door and through it: the room rig owns the pose
      if (room.w > 0.001) {
        cam.position.lerp(room.pos, room.w)
        look.current.lerp(room.look, room.w)
      }

      // entry fly-in (first seconds after ENTER)
      const k = 1 - rt.intro.t
      if (k > 0.001 && rt.world === 'alley') {
        const w = 1 - smoothstep(0, 0.06, p)
        cam.position.z += k * k * 6 * w
        cam.position.y += k * k * 0.5 * w
        fov += k * 6 * w
      }

      // transition push (dualism tunnel pulls the camera forward)
      if (rt.fx.tunnel > 0.001) {
        _dir.copy(look.current).sub(cam.position).normalize()
        cam.position.addScaledVector(_dir, rt.fx.tunnel * rt.fx.tunnel * 5)
        fov += rt.fx.tunnel * 22
      }

      cam.lookAt(look.current)

      // pointer parallax: lateral/vertical translation (real parallax — near objects move more) + tiny rotation
      cam.updateMatrixWorld()
      _right.setFromMatrixColumn(cam.matrixWorld, 0)
      _up.setFromMatrixColumn(cam.matrixWorld, 1)
      const near = (rt.world === 'roof' ? 0.5 : 1) * (1 - room.w)
      const sel = store.selected !== null ? 0.35 : 1
      cam.position.addScaledVector(_right, rt.px * 0.3 * S * near * sel)
      cam.position.addScaledVector(_up, rt.py * 0.12 * S * near * sel)
      cam.lookAt(look.current)
      cam.rotateY(-rt.px * 0.028 * S * sel)
      cam.rotateX(rt.py * 0.02 * S * sel)
      // handheld-cinema roll: authored per shot + a little bank with scroll speed and pointer
      cam.rotateZ((cs.roll + clamp(rt.velocity * 0.05, -0.01, 0.01) - rt.px * 0.004) * S)

      // breathing, only where it belongs (no breathing while the orbit is the subject)
      const breathe = (1 - rig.w) * (1 - room.w) * S
      cam.position.y += Math.sin(rt.time * 0.85) * 0.006 * breathe
      cam.position.x += Math.sin(rt.time * 0.55 + 1.3) * 0.004 * breathe
      cam.rotateZ(Math.sin(rt.time * 0.42) * 0.0012 * breathe)
    }

    // QA only: an exact, repeatable pose (comparable before/after captures)
    if (rt.camOverride) {
      const o = rt.camOverride
      cam.position.set(o.pos[0], o.pos[1], o.pos[2])
      cam.up.set(0, 1, 0)
      cam.lookAt(o.look[0], o.look[1], o.look[2])
      if (o.fov) fov = o.fov
    }

    // below the pool surface the alley is rendered as its own reflection
    rt.mirror = rt.world === 'alley' && cam.position.y < 0.02 && p > 0.6 ? 1 : 0

    // velocity kick: stretch fov a little when moving fast
    fov += clamp(Math.abs(rt.velocity) * 55, 0, 3.2) * S
    if (Math.abs(fov - lastFov.current) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
      lastFov.current = fov
    }
  }, -2)

  return null
}

/** Shows its children only while `rt.world` matches (set per frame — no React re-renders). */
export function WorldGate({ world, children, extra }: { world: 'alley' | 'roof' | 'dualism' | 'room'; children: ReactNode; extra?: () => boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const on = rt.world === world || (extra ? extra() : false)
    if (ref.current.visible !== on) ref.current.visible = on
  }, -1.5)
  return <group ref={ref}>{children}</group>
}

