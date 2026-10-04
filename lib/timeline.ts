import * as THREE from 'three'
import gsap from 'gsap'
import { rt } from './runtime'

/* ──────────────────────────────────────────────────────────────────────────
   WORLD LAYOUT (metres). The alley runs along −Z. The rooftop and the Dualismo
   space live far away on X so the three worlds never overlap or reflect.
   ────────────────────────────────────────────────────────────────────────── */
export const WORLD = {
  alleyStart: 18,
  alleyEnd: -72,
  plazaCenter: new THREE.Vector3(0, 2.7, -102),
  roofX: 600,
  dualismX: -600,
}

/** Scroll checkpoints, 0..1 of the full journey. */
export const CP = {
  entry: 0,
  hood: 0.13,
  alterco: 0.2,
  portal: 0.27,
  tracksStart: 0.36,
  tracksEnd: 0.6,
  reveal: 0.655,
  dive: 0.7,
  cut: 0.72,
  roof: 0.78,
  skyline: 0.88,
  final: 1,
}

export const SCROLL_VH = 1000 // total scroll length in viewport heights

export const NAV_POINTS = [
  { id: 'alterco', label: 'ALTERCO', p: 0.0, hint: 'Alley' },
  { id: 'tracks', label: 'TRACKS', p: CP.tracksStart + 0.005, hint: '01—07' },
  { id: 'listen', label: 'LISTEN', p: 1.0, hint: 'Rooftop' },
] as const

type V3 = [number, number, number]
interface Key {
  p: number
  pos: V3
  look: V3
  fov?: number
  roll?: number
}

/* Camera path — keyframes are eased with monotone cubic time-warping and
   a centripetal Catmull-Rom spline (position and look-at target separately). */
const R = WORLD.roofX
export const ALLEY_KEYS: Key[] = [
  { p: 0.0, pos: [1.05, 1.3, 17.5], look: [-0.5, 3.6, -30], fov: 47, roll: -0.022 },
  { p: 0.04, pos: [0.25, 1.44, 12.5], look: [-0.9, 3.5, -30], fov: 48, roll: -0.008 },
  { p: 0.08, pos: [-0.8, 1.62, 6.5], look: [0.2, 3.7, -28], fov: 49, roll: 0.012 },
  { p: 0.125, pos: [-0.25, 1.88, -1.5], look: [0.9, 4.6, -30], fov: 50, roll: 0.004 },
  { p: 0.165, pos: [0.85, 1.56, -9.5], look: [-0.3, 5.2, -30], fov: 51, roll: -0.014 },
  { p: 0.2, pos: [0.4, 1.78, -17], look: [0.0, 8.2, -30], fov: 54, roll: 0 },
  { p: 0.27, pos: [-0.3, 1.7, -37], look: [-1.6, 2.7, -58], fov: 50, roll: 0.01 },
  { p: 0.32, pos: [0.4, 1.85, -56], look: [0, 2.7, -88], fov: 50, roll: -0.006 },
  { p: 0.36, pos: [0.0, 2.45, -73], look: [0, 2.6, -102], fov: 50 },
  { p: 0.41, pos: [0.0, 2.75, -88.6], look: [0, 2.55, -102], fov: 50 },
  { p: 0.58, pos: [0.0, 2.75, -89.0], look: [0, 2.55, -102], fov: 50 },
  { p: 0.645, pos: [0.0, 2.35, -86.6], look: [0, 2.5, -102], fov: 48 },
  // lean over the pool: the reflection fills the frame …
  { p: 0.672, pos: [0.0, 1.55, -89.4], look: [0, 0.3, -95.8], fov: 54, roll: 0.01 },
  // … break the surface …
  { p: 0.698, pos: [0.0, 0.34, -93.4], look: [0, -1.0, -96.6], fov: 62, roll: -0.03 },
  // … and keep falling through the reflected alley (the world is now mirrored in y)
  { p: 0.72, pos: [0.0, -3.4, -95.4], look: [0, -8.0, -97.5], fov: 74, roll: 0.06 },
]
export const ROOF_KEYS: Key[] = [
  { p: 0.72, pos: [R, 0.3, 9], look: [R, 7, -18], fov: 72 },
  { p: 0.76, pos: [R, 1.2, 6], look: [R + 0.6, 4.2, -24], fov: 60 },
  { p: 0.8, pos: [R + 0.2, 1.6, 3], look: [R + 1.4, 3.0, -30], fov: 52 },
  { p: 0.87, pos: [R + 1.8, 1.9, -5], look: [R + 5.5, 3.5, -44], fov: 50 },
  { p: 0.94, pos: [R + 3.6, 2.1, -13], look: [R + 3.4, 3.7, -58], fov: 50 },
  { p: 1.0, pos: [R + 4.4, 2.35, -17.5], look: [R + 1.2, 4.0, -62], fov: 50 },
]

/* monotone cubic (Fritsch–Carlson) mapping progress → knot index (so speed is C1) */
function makeWarp(ps: number[]) {
  const n = ps.length
  const ys = ps.map((_, i) => i)
  const d: number[] = []
  const m: number[] = new Array(n).fill(0)
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ps[i + 1] - ps[i]))
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  return (p: number) => {
    if (p <= ps[0]) return 0
    if (p >= ps[n - 1]) return n - 1
    let i = 0
    while (p > ps[i + 1]) i++
    const h = ps[i + 1] - ps[i]
    const t = (p - ps[i]) / h
    const t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

function makePath(keys: Key[]) {
  const posC = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal')
  const lookC = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal')
  const warp = makeWarp(keys.map((k) => k.p))
  const last = keys.length - 1
  const fovs = keys.map((k) => k.fov ?? 50)
  const rolls = keys.map((k) => k.roll ?? 0)
  return { posC, lookC, warp, last, fovs, rolls, keys }
}
const alleyPath = makePath(ALLEY_KEYS)
const roofPath = makePath(ROOF_KEYS)

export interface CamSample {
  pos: THREE.Vector3
  look: THREE.Vector3
  fov: number
  roll: number
  world: 'alley' | 'roof'
}

export function sampleCamera(p: number, out: CamSample) {
  const path = p < CP.cut + 0.0005 ? alleyPath : roofPath
  out.world = path === alleyPath ? 'alley' : 'roof'
  const k = path.warp(p)
  const t = k / path.last
  path.posC.getPoint(Math.min(1, Math.max(0, t)), out.pos)
  path.lookC.getPoint(Math.min(1, Math.max(0, t)), out.look)
  const i = Math.min(path.last - 1, Math.floor(k))
  const f = k - i
  out.fov = path.fovs[i] + (path.fovs[i + 1] - path.fovs[i]) * f
  const fs = f * f * (3 - 2 * f)
  out.roll = path.rolls[i] + (path.rolls[i + 1] - path.rolls[i]) * fs
  return out
}

/* ──────────────────────────────────────────────────────────────────────────
   Param timeline — a paused GSAP timeline whose time IS the scroll progress.
   rt.fx values are scrubbed from it every frame (see SceneManager).
   ────────────────────────────────────────────────────────────────────────── */
type Ease = string
type Frames = [number, number, Ease?][]

export const scrub = {
  rgb: 0,
  liquid: 0,
  contam: 0,
  grain: 0.5,
  vignette: 0.5,
  exposure: 1,
  ripple: 0,
  blur: 0,
  cross: 0,
}

export function buildParamTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  const track = (prop: keyof typeof scrub, frames: Frames) => {
    for (let i = 0; i < frames.length - 1; i++) {
      const [p0, v0] = frames[i]
      const [p1, v1, ease] = frames[i + 1]
      tl.fromTo(scrub, { [prop]: v0 }, { [prop]: v1, duration: p1 - p0, ease: ease ?? 'sine.inOut', immediateRender: false }, p0)
    }
  }
  // street → ALTERCO: reality slowly picks up the album's visual language
  track('contam', [[0, 0], [0.18, 0.02], [0.34, 0.1], [0.5, 0.22], [0.62, 0.55, 'power2.in'], [0.71, 1], [0.78, 0.32, 'power2.out'], [0.9, 0.06], [1, 0.1]])
  // narrative chromatic aberration: nothing at the start, hints in the street, remembered-then-broken near ALTERCO, strong in the collapse, calmer after
  track('rgb', [[0, 0], [0.16, 0], [0.3, 0.0005], [0.46, 0.001], [0.58, 0.0022], [0.64, 0.006, 'power2.in'], [0.7, 0.02], [0.78, 0.004, 'power2.out'], [0.9, 0.0007], [1, 0.0006]])
  // wet pavement expands → camera passes through the reflective surface → emerges on the roof
  track('liquid', [[0, 0], [0.625, 0], [0.72, 1, 'power2.in'], [0.795, 0, 'power3.out'], [1, 0]])
  track('grain', [[0, 0.38], [0.6, 0.42], [1, 0.5]])
  track('vignette', [[0, 0.46], [0.35, 0.42], [0.72, 0.46], [0.8, 0.34], [1, 0.36]])
  track('exposure', [[0, 0.9], [0.1, 1], [0.6, 1.02], [0.72, 1.1], [0.8, 1], [1, 1.05]])
  track('blur', [[0, 0], [1, 0]])
  // the instant the camera breaks the surface of the pool
  track('cross', [[0, 0], [0.682, 0], [0.7, 1, 'power2.out'], [0.73, 0, 'sine.out'], [1, 0]])
  tl.set({}, {}, 1)
  return tl
}

export function applyScrub(tl: gsap.core.Timeline, p: number) {
  tl.time(p, true)
  const f = rt.fx
  f.rgb = scrub.rgb
  f.liquid = scrub.liquid
  f.contam = scrub.contam
  f.grain = scrub.grain
  f.vignette = scrub.vignette
  f.exposure = scrub.exposure
  f.cross = scrub.cross
}

/** Which track slot index is at the front for a given progress inside the orbit zone. */
/** scroll range in which the camera walks through the installation (track 01 at a, track 07 at b) */
export const orbitZone = { a: 0.41, b: 0.595 }
export const zoneT = (p: number) => Math.min(1, Math.max(0, (p - orbitZone.a) / (orbitZone.b - orbitZone.a)))
