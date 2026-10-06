import * as THREE from 'three'
import { rt } from './runtime'
import { clamp, damp, smoothstep } from './math'

/**
 * THE HOODDINO ROOM — spatial constants and the camera rig (pure, no React).
 *
 * The room is a separate pocket of space far from the street (like the rooftop and DUALISMO), but its doorway is the *same* doorway as
 * the one in the alley: the street door is at the alley's left wall, and the room's local frame is placed so that "walking through the
 * door" is one continuous camera move — street pose → in front of the door → through the aperture → (the world swaps while the
 * vestibule fills the frame) → the entry station. Leaving is the same move reversed, so the visitor lands on the exact street
 * pose they left (the scroll position is never touched while inside).
 *
 * Room local frame: origin = centre of the door plane on the floor, −z = into the room, +x = right-hand side when facing in.
 *   world = (ROOM_X + lz, y, DOOR.z − lx)        (the room group is rotated +90° about y)
 */
export const ROOM_X = 1200
/** the door plane stands on the street side of a small prefab entrance built against the alley's left wall (wall at x = −4.8) */
export const DOOR = { x: -3.55, z: -67, w: 1.2, h: 2.2, depth: 1.25, wallX: -4.8 }

/** room extents (local) */
export const L = { x0: -3.2, x1: 3.2, zf: -1.25, zb: -8.6, h: 2.85 }

export const toWorld = (lx: number, ly: number, lz: number, out = new THREE.Vector3()) => out.set(ROOM_X + lz, ly, DOOR.z - lx)

export type StationId = 'entry' | 'workstation' | 'bio' | 'live' | 'exit'
type V3 = [number, number, number]
export interface RoomStation {
  id: StationId
  label: string
  cam: V3
  look: V3
  fov: number
  /** alternative framing for narrow (portrait phone) viewports */
  narrow?: { cam: V3; look: V3; fov?: number }
}

export const STATIONS: RoomStation[] = [
  { id: 'entry', label: 'THE ROOM', cam: [0.1, 1.55, -2.3], look: [0.2, 1.2, -8.4], fov: 54, narrow: { cam: [0.1, 1.55, -1.9], look: [0.3, 1.2, -8.4], fov: 56 } },
  { id: 'workstation', label: 'WORKSTATION', cam: [0.25, 1.32, -5.5], look: [0.3, 1.08, -8.4], fov: 48, narrow: { cam: [0.3, 1.35, -5.6], look: [0.4, 1.08, -8.4], fov: 52 } },
  { id: 'bio', label: 'WHO IS HOODDINO?', cam: [-0.2, 1.42, -4.6], look: [3.2, 1.42, -4.55], fov: 50, narrow: { cam: [-0.7, 1.45, -5.3], look: [3.2, 1.0, -5.3], fov: 54 } },
  { id: 'live', label: 'LIVE', cam: [0.6, 1.4, -3.95], look: [-3.2, 1.2, -3.85], fov: 50, narrow: { cam: [0.3, 1.38, -3.4], look: [-3.2, 1.22, -3.3], fov: 52 } },
  { id: 'exit', label: 'EXIT', cam: [0.0, 1.5, -2.2], look: [0.0, 1.35, 3], fov: 54 },
]

/** hero close-up of the video monitor (explicit PLAY) */
export const SCREEN = { cam: [0.5, 1.28, -7.05] as V3, look: [0.5, 1.22, -8.3] as V3, fov: 42 }
/** where the vertical display stands (local): a 9:16 panel, ~29" (0.36 × 0.64 m) */
export const MONITOR = { x: 0.5, y: 1.22, z: -8.28, w: 0.36, h: 0.64 }

/** street-space poses around the door */
const STAND = new THREE.Vector3(DOOR.x + 1.75, 1.62, DOOR.z)
const STAND_LOOK_IN = new THREE.Vector3(DOOR.x - 1, 1.25, DOOR.z)
const STAND_LOOK_OUT = new THREE.Vector3(DOOR.x + 6, 1.7, DOOR.z - 0.4)
const THR = new THREE.Vector3(DOOR.x - 0.8, 1.55, DOOR.z)
const THR_LOOK_IN = new THREE.Vector3(DOOR.x - 3, 1.4, DOOR.z)
const THR_LOOK_OUT = new THREE.Vector3(DOOR.x + 3, 1.5, DOOR.z)

const camPts = [new THREE.Vector3(0, 1.55, -0.8), ...STATIONS.map((s) => new THREE.Vector3(...s.cam)), new THREE.Vector3(0, 1.55, -0.8)]
const lookPts = [new THREE.Vector3(0, 1.4, -8), ...STATIONS.map((s) => new THREE.Vector3(...s.look)), new THREE.Vector3(0, 1.5, 3)]
const posC = new THREE.CatmullRomCurve3(camPts, false, 'centripetal')
const lookC = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal')
const LAST = camPts.length - 1

export const room = {
  /** off → in (camera walks to the door and through it) → inside → out (walks back out) → off */
  phase: 'off' as 'off' | 'in' | 'inside' | 'out',
  /** the street camera is close to the door (written by StudioDoor) */
  near: false,
  /** 0..1 street pose → standing at the door; 0..1 door → threshold */
  ap: 0,
  go: 0,
  exiting: false,
  /** true while the room world is the one on screen */
  inside: false,
  /** continuous station coordinate: −1 threshold, 0 entry … 4 exit, 5 threshold (leaving) */
  u: -1,
  uT: -1,
  station: 0,
  /** video focus 0..1 (target + smoothed) and how much the room lights are lowered */
  pushT: 0,
  push: 0,
  dim: 0,
  /** door leaf opening 0..1 */
  door: 0,
  /** compile + upload the room off-screen once (approach) */
  warm: false,
  /** street-space camera poses blended in by the Director while the visitor walks to / through the door */
  w: 0,
  pos: new THREE.Vector3(),
  look: new THREE.Vector3(),
  /** inside poses (world space) */
  cpos: new THREE.Vector3(),
  clook: new THREE.Vector3(),
  fov: 50,
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3()
const ease = (t: number) => t * t * (3 - 2 * t)

/** street-space pose for the approach: lerp(stand → threshold) */
function approachPose() {
  const go = ease(clamp(room.go))
  room.pos.lerpVectors(STAND, THR, go)
  const lookStand = room.exiting ? STAND_LOOK_OUT : STAND_LOOK_IN
  const lookThr = room.exiting ? THR_LOOK_OUT : THR_LOOK_IN
  room.look.lerpVectors(lookStand, lookThr, go)
  room.w = ease(clamp(room.ap))
  room.door = smoothstep(0.5, 0.92, room.ap)
}

function stationPose(u: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const t = clamp((u + 1) / LAST)
  posC.getPoint(t, pos)
  lookC.getPoint(t, look)
  // narrow viewports: blend toward the alternative framing of the nearest station
  const nar = smoothstep(1.05, 0.75, rt.aspect)
  if (nar > 0.001) {
    const i = clamp(Math.round(u), 0, STATIONS.length - 1)
    const s = STATIONS[i]
    if (s.narrow) {
      const k = nar * (1 - clamp(Math.abs(u - i) * 2.2))
      pos.lerp(_a.set(...s.narrow.cam), k)
      look.lerp(_b.set(...s.narrow.look), k)
    }
  }
}

export function roomFov(u: number) {
  const k = clamp(u, 0, STATIONS.length - 1)
  const i = Math.floor(k)
  const f = ease(k - i)
  const a = STATIONS[i].fov, b = (STATIONS[Math.min(STATIONS.length - 1, i + 1)] ?? STATIONS[i]).fov
  return a + (b - a) * f + (u < 0 ? (1 - clamp(u + 1)) * 2 : 0)
}

const _p = new THREE.Vector3(), _l = new THREE.Vector3()

/** Called by the Director once per frame. Writes room.pos/look/w (street-space approach) and room.cpos/clook/fov (inside). */
export function stepRoom(dt: number) {
  if (room.phase === 'off') {
    room.w = 0
    room.push = room.pushT = room.dim = 0
    return
  }
  approachPose()
  if (!room.inside) return

  room.u = damp(room.u, room.uT, rt.reducedMotion ? 9 : 2.7, dt)
  room.push = damp(room.push, room.pushT, rt.reducedMotion ? 9 : 2.8, dt)
  room.dim = room.push
  stationPose(room.u, _p, _l)
  let fov = roomFov(room.u)
  // video focus: push toward the vertical monitor
  if (room.push > 0.001) {
    const k = ease(room.push)
    _p.lerp(_a.set(...SCREEN.cam), k)
    _l.lerp(_b.set(...SCREEN.look), k)
    fov += (SCREEN.fov - fov) * k
  }
  room.fov = fov
  // keep the lens inside the walls on narrow viewports (the station was authored for a wide frame)
  _p.x = clamp(_p.x, L.x0 + 0.25, L.x1 - 0.25)
  _p.z = clamp(_p.z, L.zb + 0.5, 0.2)
  toWorld(_p.x, _p.y, _p.z, room.cpos)
  toWorld(_l.x, _l.y, _l.z, room.clook)
  const st = clamp(Math.round(room.u), 0, STATIONS.length - 1)
  room.station = st
}

/** street-space door pose helpers (for the camera hand-off and the UI) */
export const doorStreet = { stand: STAND, thr: THR }
