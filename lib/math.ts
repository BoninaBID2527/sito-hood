export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const smootherstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * t * (t * (t * 6 - 15) + 10)
}
/** Frame-rate independent exponential smoothing. */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt))
export const mix = lerp
export const remap = (v: number, a: number, b: number, c = 0, d = 1) => c + ((v - a) / (b - a)) * (d - c)
/** Piece-wise bump: 0 → 1 over [a,b], hold, 1 → 0 over [c,d]. */
export const bump = (a: number, b: number, c: number, d: number, v: number) =>
  smoothstep(a, b, v) * (1 - smoothstep(c, d, v))
export const wrapPi = (a: number) => {
  const tau = Math.PI * 2
  return ((((a + Math.PI) % tau) + tau) % tau) - Math.PI
}

/** Deterministic PRNG so the procedural world is identical every load. */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Object.assign(next, {
    range: (a: number, b: number) => a + (b - a) * next(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * next()),
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
  })
}

/** Under-damped spring state for scalar values (small, intentional overshoot). */
export interface Spring {
  x: number
  v: number
}
export function stepSpring(s: Spring, target: number, k: number, c: number, dt: number) {
  // semi-implicit Euler, sub-stepped for stability on slow frames
  const n = Math.max(1, Math.ceil(dt / 0.008))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    const a = k * (target - s.x) - c * s.v
    s.v += a * h
    s.x += s.v * h
  }
  return s.x
}
