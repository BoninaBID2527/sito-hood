import * as THREE from 'three'
import { rt } from './runtime'
import { useStore } from './store'
import { clamp, damp, smoothstep } from './math'
import { COUNT, rigFov, sampleRig } from './installation'
import { zoneT } from './timeline'

/**
 * The track camera rig: continuous station coordinate `u` (0 = track 01 … 6 = track 07) with weight, inertia and magnetic snapping.
 * Stepped once per frame by the Director (before it places the camera). Everything here is plain mutable state — no React.
 *
 * Inputs that move `u`:
 *  · scroll   → uScroll = zoneT(progress) · 6          (the page scroll *is* the walk through the installation)
 *  · drag     → `drag` offset in stations, with release inertia
 *  · selected → the focused track
 * Whatever the input, the camera never travels faster than MAX_SPEED stations/s, so a violent wheel flick can never skip four tracks:
 * the camera visibly passes each one on its way.
 */
export const rig = {
  u: 0,
  vel: 0,
  drag: 0,
  dragVel: 0,
  dragging: false,
  moved: 0,
  lastDrag: -10,
  justDragged: 0,
  snapIdx: 0,
  /** 0..1 deep focus (a track opened) */
  sel: 0,
  wIn: 0,
  wOut: 0,
  /** 0..1 how much the rig owns the camera */
  w: 0,
  front: 0,
  hover: -1,
  pos: new THREE.Vector3(),
  look: new THREE.Vector3(),
  /** fov delta to add on top of the path fov */
  fov: 0,
}

const MAX_SPEED = 2.1 // stations per second
/** stations per unit of scroll progress inside the zone (for velocity-aware snapping) */
const UPS = (COUNT - 1) / (0.595 - 0.41)

export function stepRig(dt: number) {
  const p = rt.smooth
  const st = useStore.getState()
  const on = rt.world === 'alley' && p > 0.3 && p < 0.7
  rig.wIn = smoothstep(0.375, 0.41, p)
  rig.wOut = smoothstep(0.595, 0.635, p)
  rig.w = on ? rig.wIn * (1 - rig.wOut) : 0
  if (!on) return

  if (rt.orbit.resetDrag) {
    rig.drag = 0
    rig.dragVel = 0
    rt.orbit.resetDrag = false
  }
  const uScroll = zoneT(p) * (COUNT - 1)
  if (!rig.dragging) {
    rig.drag += rig.dragVel * dt
    rig.dragVel *= Math.exp(-3.2 * dt)
  }
  const total = clamp(uScroll + rig.drag, -0.35, COUNT - 1 + 0.35)

  // magnetic snap: once the input rests (or is clearly slowing), settle on the station the motion was heading to
  const idle = Math.min(rt.idle, rt.time - rig.lastDrag)
  const speed = Math.abs(rig.dragVel) + Math.abs(rt.velocity * UPS)
  const pred = total + (rt.velocity * UPS + rig.dragVel) * 0.16
  const snapW = rig.dragging ? 0 : smoothstep(0.1, 0.55, idle) * (1 - smoothstep(0.4, 2.2, speed))
  if (Math.abs(pred - rig.snapIdx) > 0.62) rig.snapIdx = clamp(Math.round(pred), 0, COUNT - 1)
  let target = total + (rig.snapIdx - total) * snapW
  if (st.selected !== null) target = st.selected

  // weighted spring (slight, controlled overshoot) with a speed limit
  if (rt.reducedMotion) {
    rig.u = damp(rig.u, target, 9, dt)
    rig.vel = 0
  } else {
    const steps = Math.max(1, Math.ceil(dt / 0.008))
    const h = dt / steps
    for (let k = 0; k < steps; k++) {
      rig.vel += ((target - rig.u) * 34 - rig.vel * 10.5) * h
      rig.vel = clamp(rig.vel, -MAX_SPEED, MAX_SPEED)
      rig.u += rig.vel * h
    }
  }
  rt.orbit.err = target - rig.u
  rt.orbit.angle = rig.u
  rt.orbit.drag = rig.drag
  rt.orbit.vel = rig.vel

  const front = clamp(Math.round(rig.u), 0, COUNT - 1)
  if (front !== st.front) useStore.getState().set({ front })
  rig.front = front
  rt.orbit.front = front

  rig.sel = damp(rig.sel, st.selected !== null ? 1 : 0, 3.6, dt)
  rt.orbit.sel = rig.sel
  rt.orbit.selIdx = st.selected ?? rt.orbit.selIdx

  // pose: entry → u → exit
  const uIn = rig.u * rig.wIn - (1 - rig.wIn)
  const uS = uIn + (COUNT - uIn) * rig.wOut
  sampleRig(uS, rig.pos, rig.look)
  rig.fov = (rigFov(rig.u) - 50) * rig.w
  // deep focus: the camera itself moves toward the track
  if (rig.sel > 0.001) rig.pos.lerp(rig.look, rig.sel * 0.3)
  // portrait: pull back so the number, the title and the artwork all fit the narrow frame
  if (rt.aspect < 1.2) {
    const f = 1 + (1.2 - rt.aspect) * 0.85
    rig.pos.sub(rig.look).multiplyScalar(f).add(rig.look)
  }
}

/** pointer / touch drag on the canvas → station offset with inertia. Returns cleanup. */
export function installTrackInput(el: HTMLElement) {
  let lastX = 0, lastY = 0, startX = 0, startY = 0, lastT = 0
  let mode: 'idle' | 'pending' | 'drag' = 'idle'
  const inZone = () => rt.world === 'alley' && rig.w > 0.5 && useStore.getState().selected === null && useStore.getState().mode === 'alterco'
  const down = (e: PointerEvent) => {
    if (!inZone()) return
    mode = 'pending'
    rig.moved = 0
    lastX = startX = e.clientX
    lastY = startY = e.clientY
    lastT = performance.now()
    rig.dragVel = 0
  }
  const move = (e: PointerEvent) => {
    if (mode === 'idle') return
    const dx = e.clientX - lastX
    if (mode === 'pending') {
      const ax = Math.abs(e.clientX - startX), ay = Math.abs(e.clientY - startY)
      if (ax < 8 && ay < 8) return
      // vertical intent belongs to the page scroll; horizontal intent drags the installation
      if (ay > ax * 1.1) { mode = 'idle'; return }
      mode = 'drag'
      rig.dragging = true
    }
    const now = performance.now()
    const dt = Math.max(1, now - lastT) / 1000
    lastX = e.clientX
    lastY = e.clientY
    lastT = now
    rig.moved += Math.abs(dx)
    // one full-width swipe ≈ three stations; drag left = forward
    const k = 3.0 / Math.max(600, rt.width)
    rig.drag -= dx * k
    rig.dragVel = damp(rig.dragVel, (-dx * k) / dt, 18, 0.016)
    rig.lastDrag = rt.time
    if (rig.moved > 6) useStore.getState().setCursor('drag', 'DRAG')
  }
  const up = () => {
    if (mode === 'drag') {
      rig.dragging = false
      rig.lastDrag = rt.time
      rig.justDragged = rig.moved > 6 ? rt.time : 0
      rig.dragVel = clamp(rig.dragVel, -4, 4)
      if (useStore.getState().cursor.kind === 'drag') useStore.getState().setCursor('default')
    }
    mode = 'idle'
  }
  el.addEventListener('pointerdown', down, { passive: true })
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerup', up, { passive: true })
  window.addEventListener('pointercancel', up, { passive: true })
  return () => {
    el.removeEventListener('pointerdown', down)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
}
