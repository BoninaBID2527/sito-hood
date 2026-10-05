import * as THREE from 'three'

/**
 * Build-time "lightmap" helpers for THE HOODDINO ROOM. The room has no shadow maps (fill rate is the budget): contact, corner occlusion,
 * grime and the footprint of the practical lights are computed once on the CPU and stored in vertex colours / one small floor texture.
 * Nothing here runs per frame.
 */

/** an axis-aligned occluder: soft contact darkening on every surface near it */
export interface Occluder {
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number
  /** peak darkening 0..1 (default 0.55) */
  k?: number
  /** falloff radius in metres (default 0.3) */
  r?: number
}

export const occ = (cx: number, cz: number, w: number, d: number, y0: number, y1: number, k = 0.55, r = 0.3): Occluder =>
  ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1, k, r })

/** 0 = fully occluded … 1 = open, for a surface point p with unit normal n */
export function occlusionAt(px: number, py: number, pz: number, nx: number, ny: number, nz: number, list: Occluder[]) {
  let ao = 1
  for (const o of list) {
    const qx = Math.max(o.x0, Math.min(o.x1, px)), qy = Math.max(o.y0, Math.min(o.y1, py)), qz = Math.max(o.z0, Math.min(o.z1, pz))
    const dx = qx - px, dy = qy - py, dz = qz - pz
    const d = Math.hypot(dx, dy, dz)
    const r = o.r ?? 0.3
    if (d > r * 2.2) continue
    // the occluder must be in front of the surface (cosine-ish weight); a point inside / on the box counts fully
    const facing = d < 1e-4 ? 1 : Math.max(0, (dx * nx + dy * ny + dz * nz) / d) * 0.8 + 0.2
    const f = Math.exp(-((d / r) * (d / r)))
    ao *= 1 - (o.k ?? 0.55) * facing * f
  }
  return ao
}

/** a practical light baked into surfaces (multiplicative boost on top of the runtime lighting) */
export interface Bake {
  x: number; y: number; z: number
  color: THREE.Color
  /** boost at 1 m, facing the light */
  i: number
  /** distance at which the boost halves */
  r: number
  /** optional cone: unit axis + cos of the half angle (+ softness) */
  dir?: [number, number, number]
  cone?: number
  soft?: number
}

const _c = new THREE.Color()
/** adds the baked light boost to `out` (rgb, linear) */
export function bakeLights(px: number, py: number, pz: number, nx: number, ny: number, nz: number, list: Bake[], out: [number, number, number]) {
  for (const b of list) {
    let dx = b.x - px, dy = b.y - py, dz = b.z - pz
    const d = Math.hypot(dx, dy, dz) + 1e-5
    dx /= d; dy /= d; dz /= d
    const ndl = Math.max(0, nx * dx + ny * dy + nz * dz)
    if (ndl <= 0) continue
    let cone = 1
    if (b.dir && b.cone !== undefined) {
      const c = -(dx * b.dir[0] + dy * b.dir[1] + dz * b.dir[2])
      const s = b.soft ?? 0.2
      cone = Math.max(0, Math.min(1, (c - b.cone) / s))
      cone = cone * cone * (3 - 2 * cone)
    }
    const fall = 1 / (1 + (d / b.r) * (d / b.r))
    const k = b.i * ndl * fall * cone
    _c.copy(b.color)
    out[0] += _c.r * k; out[1] += _c.g * k; out[2] += _c.b * k
  }
}

/** smooth 3D value noise 0..1 (for mottling, stains) */
const H = (x: number, y: number, z: number) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const fx = x - xi, fy = y - yi, fz = z - zi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(H(xi, yi, zi), H(xi + 1, yi, zi), u), l(H(xi, yi + 1, zi), H(xi + 1, yi + 1, zi), u), v),
    l(l(H(xi, yi, zi + 1), H(xi + 1, yi, zi + 1), u), l(H(xi, yi + 1, zi + 1), H(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}
export const fbm3 = (x: number, y: number, z: number) => noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15

/** grid tick positions between a0 and a1: dense near both ends (corner gradients), `step` in the middle, plus forced breaks */
export function ticks(a0: number, a1: number, step = 0.4, near = [0.04, 0.1, 0.19, 0.32, 0.5], extra: number[] = []) {
  const set = new Set<number>()
  const add = (v: number) => { if (v > a0 + 1e-4 && v < a1 - 1e-4) set.add(Math.round(v * 1e4) / 1e4) }
  for (const d of near) { add(a0 + d); add(a1 - d) }
  for (const e of extra) add(e)
  const key = [a0, ...[...set].sort((a, b) => a - b), a1]
  const out: number[] = [a0]
  for (let i = 1; i < key.length; i++) {
    const g = key[i] - key[i - 1]
    const n = Math.max(1, Math.ceil(g / step))
    for (let k = 1; k <= n; k++) out.push(key[i - 1] + (g * k) / n)
  }
  return out
}
