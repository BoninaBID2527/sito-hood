import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { L, DOOR } from '@/lib/room'
import { Batch } from './batch'
import { type Bake, type Occluder, bakeLights, fbm3, occlusionAt, ticks } from './bake'

/**
 * The room's envelope: subdivided wall / ceiling planes whose vertex colours carry the paint, corner + furniture occlusion, grime and the
 * separate irradiance attribute for installed practical lights, plus the trim that makes the junctions read as built (baseboard, dado rail, crown, door casing).
 */

export const PAINT = { upper: '#686d68', lower: '#323a3c', ceiling: '#363936' }
export const DADO = 0.96
const OPEN_W = 0.75 // half width of the airlock opening in the front wall
const OPEN_H = 2.5

type Face = '+x' | '-x' | '+z' | '-z' | '+y' | '-y'
interface Env { occ: Occluder[]; bakes: Bake[] }

/** a subdivided quad grid with per-vertex colour from `paint` */
function grid(face: Face, fixed: number, a0: number, a1: number, b0: number, b1: number, env: Env, paint: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => [number, number, number], tile: number, extraA: number[] = [], extraB: number[] = [], step = 0.4) {
  const A = ticks(a0, a1, step, undefined, extraA), B = ticks(b0, b1, step, undefined, extraB)
  const nA = A.length, nB = B.length
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], bounce: number[] = [], idx: number[] = []
  const N: [number, number, number] = face === '+x' ? [1, 0, 0] : face === '-x' ? [-1, 0, 0] : face === '+z' ? [0, 0, 1] : face === '-z' ? [0, 0, -1] : face === '+y' ? [0, 1, 0] : [0, -1, 0]
  for (let j = 0; j < nB; j++) for (let i = 0; i < nA; i++) {
    const a = A[i], b = B[j]
    // (a,b) → xyz: walls: a along the wall, b = height. floor / ceiling: a = x, b = z
    let x: number, y: number, z: number
    if (face === '+z' || face === '-z') { x = a; y = b; z = fixed } else if (face === '+x' || face === '-x') { x = fixed; y = b; z = a } else { x = a; y = fixed; z = b }
    pos.push(x, y, z); nor.push(...N)
    uv.push(a / tile, (face === '+y' || face === '-y' ? b : b) / tile)
    const c = paint(x, y, z, N[0], N[1], N[2])
    const o = occlusionAt(x, y, z, N[0], N[1], N[2], env.occ)
    const add: [number, number, number] = [0, 0, 0]
    bakeLights(x, y, z, N[0], N[1], N[2], env.bakes, add)
    col.push(c[0] * o, c[1] * o, c[2] * o)
    bounce.push(add[0] * o, add[1] * o, add[2] * o)
  }
  for (let j = 0; j < nB - 1; j++) for (let i = 0; i < nA - 1; i++) {
    const p = j * nA + i
    idx.push(p, p + 1, p + nA + 1, p, p + nA + 1, p + nA)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('roomBake', new THREE.Float32BufferAttribute(bounce, 3))
  g.setIndex(idx)
  // winding: make the first triangle face along N
  const a = new THREE.Vector3().fromArray(pos, idx[0] * 3), b = new THREE.Vector3().fromArray(pos, idx[1] * 3), c = new THREE.Vector3().fromArray(pos, idx[2] * 3)
  const nn = b.sub(a).cross(c.sub(a))
  if (nn.x * N[0] + nn.y * N[1] + nn.z * N[2] < 0) {
    const ix = g.index!.array as Uint16Array | Uint32Array
    for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t }
  }
  return g
}

const tmp = new THREE.Color()
const mixc = (a: string, b: string, t: number) => { tmp.set(a).lerp(new THREE.Color(b), t); return [tmp.r, tmp.g, tmp.b] as [number, number, number] }

/** painted wall colour at a point: dado split, mottling, grime near the floor, smoke near the ceiling, stains, corner occlusion */
function wallPaint(env: Env) {
  return (x: number, y: number, z: number): [number, number, number] => {
    const t = Math.min(1, Math.max(0, (y - (DADO - 0.004)) / 0.008))
    const c = mixc(PAINT.lower, PAINT.upper, t)
    // mottling: patchy roller coverage (low frequency) + a broader tone drift
    const m = 0.88 + 0.24 * fbm3(x * 1.4 + 3.1, y * 1.1, z * 1.4 + 7.7)
    // dirt where hands, shoes and chairs reach; smoke / dust under the ceiling
    const dirt = 1 - 0.34 * Math.exp(-y / 0.3) - 0.14 * Math.exp(-(L.h - y) / 0.35)
    // scuffs: elongated darker bruises low on the wall
    const sc = 1 - 0.16 * Math.max(0, fbm3(x * 5 + 11, y * 2.2, z * 5) - 0.55) * 3 * Math.exp(-y / 0.7)
    // corner occlusion (walls meet floor, ceiling, each other)
    const dx = Math.min(x - L.x0, L.x1 - x), dz = Math.min(z - L.zb, L.zf - z)
    const corner = 1 - 0.5 * Math.exp(-dx / 0.2) * (Math.abs(z - L.zb) < 1e-3 || Math.abs(z - L.zf) < 1e-3 ? 1 : 0) - 0.5 * Math.exp(-dz / 0.2) * (Math.abs(x - L.x0) < 1e-3 || Math.abs(x - L.x1) < 1e-3 ? 1 : 0)
    const floorAO = 1 - 0.45 * Math.exp(-y / 0.16)
    const ceilAO = 1 - 0.5 * Math.exp(-(L.h - y) / 0.2)
    const k = m * dirt * sc * corner * floorAO * ceilAO
    void env
    return [c[0] * k, c[1] * k, c[2] * k]
  }
}

export interface ShellGeo { walls: THREE.BufferGeometry; ceiling: THREE.BufferGeometry }

export function buildShell(env: Env): ShellGeo {
  const { x0, x1, zf, zb, h } = L
  const wp = wallPaint(env)
  const breaks = [0.1, 0.12, DADO - 0.006, DADO + 0.006, 2.42, h - 0.12, h - 0.1]
  const cut = (v: number[], lo: number, hi: number) => v.filter((t) => t > lo && t < hi)
  const w: THREE.BufferGeometry[] = [
    grid('+z', zb, x0, x1, 0, h, env, wp, 1.6, [], breaks),
    grid('+x', x0, zb, zf, 0, h, env, wp, 1.6, [], breaks),
    grid('-x', x1, zb, zf, 0, h, env, wp, 1.6, [], breaks),
    // front wall: left of the opening, right of it, and the lintel above it
    grid('-z', zf, x0, -OPEN_W, 0, h, env, wp, 1.6, [], breaks),
    grid('-z', zf, OPEN_W, x1, 0, h, env, wp, 1.6, [], breaks),
    grid('-z', zf, -OPEN_W, OPEN_W, OPEN_H, h, env, wp, 1.6, [], cut(breaks, OPEN_H, h)),
  ]
  // the front wall faces −z; the room is at z < zf … so its visible side (toward the room) faces −z. ✓.
  const ceilPaint = (x: number, y: number, z: number): [number, number, number] => {
    const c = new THREE.Color(PAINT.ceiling)
    const dx = Math.min(x - x0, x1 - x), dz = Math.min(z - zb, zf - z)
    const k = (0.9 + 0.2 * fbm3(x * 0.9, 2, z * 0.9)) * (1 - 0.45 * Math.exp(-dx / 0.25)) * (1 - 0.45 * Math.exp(-dz / 0.25))
    return [c.r * k, c.g * k, c.b * k]
  }
  const ceiling = grid('-y', h, x0, x1, zb, zf, env, ceilPaint, 1.6, [], [], 0.5)
  const merged = mergeGeometries(w, false)!
  w.forEach((g) => g.dispose())
  return { walls: merged, ceiling }
}

/** the floor: one plane, world-metre UVs (boards run along z) */
export function buildFloor(level: number) {
  const { x0, x1, zf, zb } = L
  const g = new THREE.PlaneGeometry(x1 - x0, zf - zb, 1, 1)
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, 0, (zf + zb) / 2)
  const uv = g.attributes.uv, pos = g.attributes.position
  const tile = 1.68
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile)
  void level
  return g
}

/** trim + door casing + threshold (into the batches the caller owns) */
export function buildTrim(matte: Batch, satin: Batch, metal: Batch) {
  const { x0, x1, zf, zb, h } = L
  const TRIM = '#16181b'
  const t = 0.018, bh = 0.11
  // baseboard: three walls + the front wall (both sides of the opening), a bevelled cap on top
  const base = (x: number, z: number, w: number, d: number) => {
    satin.box(w, bh, d, x, bh / 2, z, TRIM, { r: 0.004, ao: 0 })
    satin.box(w + (w > d ? 0 : 0.006), 0.012, d + (d > w ? 0 : 0.006), x, bh + 0.004, z, '#222528', { ao: 0 })
  }
  base(0, zb + t / 2, x1 - x0, t)
  base(x0 + t / 2, (zf + zb) / 2, t, zf - zb)
  base(x1 - t / 2, (zf + zb) / 2, t, zf - zb)
  base((x0 - OPEN_W) / 2, zf - t / 2, -OPEN_W - x0, t)
  base((x1 + OPEN_W) / 2, zf - t / 2, x1 - OPEN_W, t)
  // dado rail: a slim moulding where the two paints meet
  const rail = (x: number, z: number, w: number, d: number) => matte.box(w, 0.028, d, x, DADO, z, '#1c1a18', { r: 0.004, ao: 0 })
  rail(0, zb + 0.011, x1 - x0, 0.022)
  // crown / ceiling trim
  const crown = (x: number, z: number, w: number, d: number) => matte.box(w, 0.05, d, x, h - 0.025, z, '#1a1b1e', { ao: 0 })
  crown(0, zb + 0.025, x1 - x0, 0.05)
  crown(x0 + 0.025, (zf + zb) / 2, 0.05, zf - zb)
  crown(x1 - 0.025, (zf + zb) / 2, 0.05, zf - zb)
  crown((x0 - OPEN_W) / 2, zf - 0.025, -OPEN_W - x0, 0.05)
  crown((x1 + OPEN_W) / 2, zf - 0.025, x1 - OPEN_W, 0.05)

  /* ── the doorway into the airlock: casing, head, plinth blocks, threshold ── */
  const cz = zf - 0.012, cw = 0.075
  const CASE = '#1b1c1f'
  matte.box(cw, OPEN_H + cw, 0.024, -OPEN_W - cw / 2, (OPEN_H + cw) / 2, cz, CASE, { r: 0.004, ao: 0.2 })
  matte.box(cw, OPEN_H + cw, 0.024, OPEN_W + cw / 2, (OPEN_H + cw) / 2, cz, CASE, { r: 0.004, ao: 0.2 })
  matte.box(OPEN_W * 2 + cw * 2, cw, 0.03, 0, OPEN_H + cw / 2, cz - 0.003, CASE, { r: 0.004, ao: 0 })
  // lintel cap + a worn paint line where hands push the door
  metal.box(OPEN_W * 2 + cw * 2 + 0.02, 0.012, 0.04, 0, OPEN_H + cw + 0.006, cz - 0.004, '#3a3d42', { ao: 0 })
  // threshold: a brushed aluminium strip across the opening (and a dark rubber mat edge behind it)
  metal.box(OPEN_W * 2, 0.014, 0.12, 0, 0.007, zf - 0.06, '#8d9096', { r: 0.003, ao: 0 })
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) metal.cyl(0.005, 0.005, 0.003, sx * (OPEN_W - 0.06) + 0 * i, 0.0155, zf - 0.06 + (i - 1.5) * 0.026, '#55585d', { n: 6, ao: 0 })
}

void DOOR
