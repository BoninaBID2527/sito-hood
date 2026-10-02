'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { alterco } from '@/data/project'
import { rt } from '@/lib/runtime'
import { useStore, TRACK_COUNT } from '@/lib/store'
import { selectTrack } from '@/lib/actions'
import { clamp, damp, smoothstep, wrapPi } from '@/lib/math'
import { WORLD, zoneT } from '@/lib/timeline'
import { palette } from '@/lib/timeOfDay'
import { createCardMaterial } from './TrackCard3D'

const SLOT = (Math.PI * 2) / TRACK_COUNT
const CARD_W = 2.15
const CARD_H = 3.0
const TILT = 0.2

const _f = new THREE.Vector3()
const _r = new THREE.Vector3()
const _u = new THREE.Vector3()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _e = new THREE.Euler()

/**
 * Seven real 3D cards on a tilted elliptical orbit around the artwork.
 * Scroll drives the orbit angle (via the camera spring), drag adds inertial momentum,
 * and idle time gently snaps the nearest card to the front.
 */
export function TrackOrbit() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const root = useRef<THREE.Group>(null)
  const cardRefs = useRef<(THREE.Group | null)[]>([])
  const mats = useMemo(() => A.cards.map((t) => createCardMaterial(t)), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(CARD_W, CARD_H, 10, 14), [])
  const pool = useMemo(
    () => new THREE.MeshBasicMaterial({ map: A.glow, color: new THREE.Color('#ffb070'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    [],
  )
  const poolGeo = useMemo(() => new THREE.PlaneGeometry(16, 16), [])

  const ph = useRef({
    angle: 0,
    vel: 0,
    drag: 0,
    dragVel: 0,
    dragging: false,
    moved: 0,
    lastDrag: -10,
    justDragged: 0,
    hover: -1,
    hoverSm: new Array(TRACK_COUNT).fill(0),
    focus: new Array(TRACK_COUNT).fill(0),
    selAmt: 0,
    sheen: new THREE.Vector2(0.5, 0.5),
  })

  // drag / swipe on the canvas
  useEffect(() => {
    const el = gl.domElement
    let lastX = 0
    let lastT = 0
    const inZone = () => rt.world === 'alley' && rt.smooth > 0.3 && rt.smooth < 0.66 && useStore.getState().selected === null && useStore.getState().mode === 'alterco'
    const down = (e: PointerEvent) => {
      if (!inZone()) return
      ph.current.dragging = true
      ph.current.moved = 0
      lastX = e.clientX
      lastT = performance.now()
      ph.current.dragVel = 0
    }
    const move = (e: PointerEvent) => {
      const p = ph.current
      if (!p.dragging) return
      const dx = e.clientX - lastX
      const now = performance.now()
      const dt = Math.max(1, now - lastT) / 1000
      lastX = e.clientX
      lastT = now
      p.moved += Math.abs(dx)
      // horizontal drag rotates the universe (angle per px scales with viewport width)
      const k = (Math.PI * 1.6) / Math.max(600, rt.width)
      p.drag += dx * k
      p.dragVel = damp(p.dragVel, (dx * k) / dt, 18, 0.016)
      p.lastDrag = rt.time
      if (p.moved > 6) useStore.getState().setCursor('drag', 'DRAG')
    }
    const up = () => {
      const p = ph.current
      if (!p.dragging) return
      p.dragging = false
      p.lastDrag = rt.time
      p.justDragged = p.moved > 6 ? rt.time : 0
      p.dragVel = clamp(p.dragVel, -5, 5)
      if (useStore.getState().cursor.kind === 'drag') useStore.getState().setCursor('default')
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose())
      geo.dispose()
      pool.dispose()
      poolGeo.dispose()
    },
    [mats, geo, pool, poolGeo],
  )

  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    const p = rt.smooth
    const on = rt.world === 'alley' && p > 0.27 && p < 0.74
    if (g.visible !== on) g.visible = on
    if (!on) return
    const st = useStore.getState()
    const ph_ = ph.current
    if (rt.orbit.resetDrag) {
      ph_.drag = 0
      ph_.dragVel = 0
      rt.orbit.resetDrag = false
    }
    const aspect = rt.aspect
    const rs = 0.62 + 0.38 * smoothstep(0.5, 1.4, aspect)

    // ── angular physics
    const zt = zoneT(p)
    const scrollAngle = -zt * (TRACK_COUNT - 1) * SLOT
    if (!ph_.dragging) {
      ph_.drag += ph_.dragVel * dt
      ph_.dragVel *= Math.exp(-3.4 * dt)
    }
    const total = scrollAngle + ph_.drag
    const idle = Math.min(rt.idle, rt.time - ph_.lastDrag)
    const snapW = ph_.dragging ? 0 : smoothstep(0.1, 0.55, idle) * (1 - smoothstep(0.5, 2.5, Math.abs(ph_.dragVel)))
    const snapped = Math.round(total / SLOT) * SLOT
    let target = total + (snapped - total) * snapW
    if (st.selected !== null) {
      // park the ring with the selected card nearest the front (shortest way round)
      const want = -st.selected * SLOT
      const k = Math.round((ph_.angle - want) / (Math.PI * 2))
      target = want + k * Math.PI * 2
    }
    const err = target - ph_.angle
    rt.orbit.err = err
    ph_.vel += (err * 58 - ph_.vel * 11) * dt
    ph_.vel = clamp(ph_.vel, -6.5, 6.5) // never uncontrolled spinning
    ph_.angle += ph_.vel * dt
    rt.orbit.angle = ph_.angle
    rt.orbit.vel = ph_.vel

    const front = ((Math.round(-ph_.angle / SLOT) % TRACK_COUNT) + TRACK_COUNT) % TRACK_COUNT
    if (front !== st.front) useStore.getState().set({ front })
    rt.orbit.front = front

    // ── assemble / recede
    const appear = smoothstep(0.3, 0.4, p)
    const recede = smoothstep(0.6, 0.665, p)
    const expand = recede * 1.1

    // ── camera basis for the focus pose
    camera.updateMatrixWorld()
    _r.setFromMatrixColumn(camera.matrixWorld, 0)
    _u.setFromMatrixColumn(camera.matrixWorld, 1)
    _f.setFromMatrixColumn(camera.matrixWorld, 2).negate()
    const dist = aspect > 1.2 ? 5.2 : 6.6
    const offX = aspect > 1.2 ? 1.55 : 0
    const offY = aspect > 1.2 ? 0 : 0.7

    ph_.selAmt = damp(ph_.selAmt, st.selected !== null ? 1 : 0, 4, dt)
    const C = WORLD.plazaCenter
    const Rx = 5.9 * rs * (1 + expand * 0.6)
    const Rz = 4.5 * rs * (1 + expand * 0.6)
    const cs = (0.62 + 0.38 * rs) // card scale on small screens
    const hovered = ph_.hover

    for (let i = 0; i < TRACK_COUNT; i++) {
      const grp = cardRefs.current[i]
      if (!grp) continue
      const m = mats[i]
      // hover repels neighbours
      ph_.hoverSm[i] = damp(ph_.hoverSm[i], hovered === i && st.selected === null ? 1 : 0, 9, dt)
      let theta = i * SLOT + ph_.angle
      if (hovered >= 0 && hovered !== i && st.selected === null) {
        const d = wrapPi((i - hovered) * SLOT)
        theta += Math.sign(d) * 0.17 * Math.exp(-Math.abs(d) * 1.1)
      }
      const x = Math.sin(theta) * Rx
      const zl = Math.cos(theta) * Rz
      const y = C.y - zl * Math.sin(TILT) + Math.sin(rt.time * 0.7 + i * 1.3) * 0.05 * (rt.reducedMotion ? 0 : 1) - 0.1
      const z = C.z + zl * Math.cos(TILT)
      const far = (1 - Math.cos(theta)) / 2
      _p.set(C.x + x, y, z)

      // hover: lean toward the camera
      const h = ph_.hoverSm[i]
      if (h > 0.001) {
        _f.set(0, 0, 0)
        _p.z += h * 0.85
        _p.y += h * 0.1
      }
      _f.setFromMatrixColumn(camera.matrixWorld, 2).negate()

      // base orientation: face outward, softened so side cards stay readable
      _e.set(0, wrapPi(theta) * 0.5, Math.sin(i * 2.1) * 0.03)
      _q.setFromEuler(_e)
      let scale = cs * (1 + h * 0.06)

      // focus pose
      const isSel = st.selected === i
      ph_.focus[i] = damp(ph_.focus[i], isSel ? 1 : 0, 4.2, dt)
      const e = ph_.focus[i]
      if (e > 0.001) {
        const fx = camera.position.x + _f.x * dist + _r.x * offX + _u.x * offY
        const fy = camera.position.y + _f.y * dist + _r.y * offX + _u.y * offY
        const fz = camera.position.z + _f.z * dist + _r.z * offX + _u.z * offY
        const ease = e * e * (3 - 2 * e)
        _p.lerp(new THREE.Vector3(fx, fy, fz), ease)
        _q2.copy(camera.quaternion)
        _e.set(rt.py * -0.05, rt.px * 0.08, 0)
        _q2.multiply(new THREE.Quaternion().setFromEuler(_e))
        _q.slerp(_q2, ease)
        scale = THREE.MathUtils.lerp(scale, (aspect > 1.2 ? 1.12 : 0.95) * cs, ease)
      } else if (ph_.selAmt > 0.001) {
        // other cards fall back
        _p.x = THREE.MathUtils.lerp(_p.x, C.x + x * 1.25, ph_.selAmt)
        _p.z -= ph_.selAmt * 2.2
        scale *= 1 - ph_.selAmt * 0.12
      }

      // appear scale
      scale *= 0.85 + 0.15 * appear
      grp.position.copy(_p)
      grp.quaternion.copy(_q)
      grp.scale.setScalar(scale)

      const u = m.uniforms
      u.uTime.value = rt.time
      u.uHover.value = isSel ? 0.9 : h
      u.uFar.value = isSel ? 0 : far * (1 - ph_.selAmt * 0.0) * (1 - e)
      u.uDim.value = isSel ? 0 : ph_.selAmt * 0.9 + recede * 0.7
      u.uRgb.value = clamp(Math.abs(ph_.vel) * 0.0012, 0, 0.012) + rt.fx.contam * 0.002 + h * 0.0015
      u.uBend.value = clamp(ph_.vel * 0.12, -1, 1)
      u.uAppear.value = clamp(appear * 1.2 - i * 0.02, 0, 1) * (1 - recede * 0.3)
      u.uFog.value.copy(palette.fog)
      ph_.sheen.set(clamp(rt.px * 0.5 + 0.5), clamp(rt.py * 0.5 + 0.5))
      u.uSheen.value.copy(ph_.sheen)
      grp.renderOrder = isSel ? 20 : Math.round((1 - far) * 10)
      grp.visible = u.uAppear.value > 0.01
    }
    // pool of light on the wet ground under the orbit
    pool.opacity = appear * (1 - recede * 0.7) * (0.12 + palette.lamps * 0.1)
  }, -0.4)

  const C = WORLD.plazaCenter
  return (
    <group ref={root} visible={false}>
      {alterco.tracks.map((tr, i) => (
        <group key={tr.id} ref={(r) => { cardRefs.current[i] = r }}>
          <mesh
            geometry={geo}
            material={mats[i]}
            onPointerOver={(e) => {
              if (rt.touch || useStore.getState().selected !== null) return
              e.stopPropagation()
              ph.current.hover = i
              useStore.getState().setCursor('track', 'VIEW')
            }}
            onPointerOut={() => {
              if (ph.current.hover === i) ph.current.hover = -1
              if (useStore.getState().cursor.kind === 'track') useStore.getState().setCursor('default')
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (rt.time - ph.current.justDragged < 0.25 || ph.current.moved > 6) return
              if (useStore.getState().selected === i) return
              selectTrack(i)
            }}
          />
        </group>
      ))}
      <mesh geometry={poolGeo} material={pool} position={[C.x, 0.035, C.z + 1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />
    </group>
  )
}
