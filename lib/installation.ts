import * as THREE from 'three'
import { WORLD } from './timeline'

/**
 * THE ALTERCO TRACK INSTALLATION — data and camera rig (pure, no React).
 *
 * The plaza holds one sculptural installation: the official ALTERCO artwork stands at its centre and the seven tracks hang around it
 * at different depths, heights, scales and angles (never a flat ring of identical cards). The camera does not wait for them: it
 * circles the installation on an outer path, one pose per track, always looking *inward*, so the artwork is the shared background of
 * every composition and the neighbouring tracks sit in peripheral depth.
 *
 *   entry (the old static plaza pose) → 01 → 02 → … → 07 → exit (back to the old pose, where the dive into the pool starts)
 */
export const COUNT = 7
const C = WORLD.plazaCenter // artwork centre

/** station angles around the artwork (deg; 0 = the entrance side, counter-clockwise: west → north → east → back to the entrance) */
const ANG = [38, 92, 146, 196, 248, 302, 350]
/** radius multiplier on the inner ellipse (each object has its own depth) */
const RAD = [1.0, 1.16, 0.9, 1.08, 1.12, 0.96, 1.06]
/** object height */
const Y = [2.3, 3.5, 2.5, 4.7, 2.1, 3.1, 2.6]
/** inner ellipse (objects) */
const ROX = 3.9, ROZ = 5.9
/** camera distance from its object, outward (m) and its height above the object centre */
const CAM_D = [5.9, 5.6, 6.1, 7.2, 5.8, 5.9, 5.8]
const CAM_DY = [0.35, 0.15, 0.4, -0.7, 0.4, 0.25, 0.2]
/** how far the look-target is pulled from the object toward the artwork (0 = object, 1 = artwork) */
const BIAS = [0.3, 0.26, 0.3, 0.16, 0.3, 0.28, 0.22]
/** camera field of view per station (closer / wider for the monumental one) */
export const FOV = [50, 50, 50, 54, 50, 50, 49]

export interface Station {
  pos: THREE.Vector3
  cam: THREE.Vector3
  look: THREE.Vector3
  /** y rotation that makes the object face its camera */
  yaw: number
  /** unit vector in plan, centre → object */
  out: THREE.Vector2
}

const ENTRY = new THREE.Vector3(0, 2.75, -89.0)
const ENTRY_LOOK = new THREE.Vector3(0, 2.55, -102)

export const STATIONS: Station[] = ANG.map((deg, i) => {
  const a = (deg * Math.PI) / 180
  const pos = new THREE.Vector3(C.x - Math.sin(a) * ROX * RAD[i], Y[i], C.z + Math.cos(a) * ROZ * RAD[i])
  const out = new THREE.Vector2(pos.x - C.x, pos.z - C.z).normalize()
  const cam = new THREE.Vector3(pos.x + out.x * CAM_D[i], pos.y + CAM_DY[i], pos.z + out.y * CAM_D[i])
  const look = new THREE.Vector3().lerpVectors(pos, new THREE.Vector3(C.x, pos.y, C.z), BIAS[i])
  return { pos, cam, look, yaw: Math.atan2(cam.x - pos.x, cam.z - pos.z), out }
})

const camPts = [ENTRY, ...STATIONS.map((s) => s.cam), ENTRY]
const lookPts = [ENTRY_LOOK, ...STATIONS.map((s) => s.look), ENTRY_LOOK]
const posC = new THREE.CatmullRomCurve3(camPts, false, 'centripetal')
const lookC = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal')
const LAST = camPts.length - 1

/** pose along the rig for the continuous station coordinate u (−1 = entry, 0…6 = the seven tracks, 7 = exit) */
export function sampleRig(u: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const t = Math.min(1, Math.max(0, (u + 1) / LAST))
  posC.getPoint(t, pos)
  lookC.getPoint(t, look)
}

/** fov between neighbouring stations */
export function rigFov(u: number) {
  const k = Math.min(COUNT - 1, Math.max(0, u))
  const i = Math.floor(k)
  const f = k - i
  const s = f * f * (3 - 2 * f)
  return FOV[i] + ((FOV[Math.min(COUNT - 1, i + 1)] ?? FOV[i]) - FOV[i]) * s
}

/** world positions of the overhead truss: an ellipse over the whole installation */
export const TRUSS = { cx: C.x, cz: C.z, rx: 7.2, rz: 9.4, y: C.y + 5.6 }

/** camera path samples for foreground occluders (poles that pass close to the lens between stations) */
export function railPoints(n = 7) {
  const out: { p: THREE.Vector3; side: THREE.Vector2 }[] = []
  const p = new THREE.Vector3(), l = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    const u = i - 0.5
    sampleRig(u, p, l)
    const dir = new THREE.Vector2(l.x - p.x, l.z - p.z).normalize()
    // inward (toward the artwork) side of the path, alternating slightly so the poles are not a fence
    const inward = new THREE.Vector2(C.x - p.x, C.z - p.z).normalize()
    out.push({ p: p.clone(), side: inward.addScaledVector(dir, 0.0) })
  }
  return out
}
