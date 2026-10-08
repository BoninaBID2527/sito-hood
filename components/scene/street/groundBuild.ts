import * as THREE from 'three'
import { rng, smoothstep } from '@/lib/math'
import { GeoBuilder, worldUV } from '@/lib/geo'
import { SEGS, PLAZA } from './layout'
import { withWhite } from './facadeBuild'

/**
 * V3.6 — the street as TOPOGRAPHY instead of a flat plane.
 *  · a crowned road that falls toward the kerbs, a shallow gutter channel along each kerb, a gentle fall across the plaza
 *  · depressions where the puddle mask says water stays (the water layer is depth-tested against this surface and its level rises with
 *    the journey, so a puddle edge is where the water meets the ground — not where a texture ends)
 *  · stone kerb blocks (1.8 m, tiny joints, uneven height, chipped top edges) and storm-drain grates in the gutter
 */
export const GROUND = { w: 44, zNear: 28, zFar: -152, cz: -62 }

/** road half-width (wall to kerb inner face) at depth z, per side */
export function kerbX(side: -1 | 1, z: number): number {
  if (z < PLAZA.z0) return 99
  const s = SEGS.find((q) => q.side === side && z <= q.z0 && z >= q.z1) ?? SEGS.filter((q) => q.side === side)[0]
  return s.hw - 0.95 - 0.2
}

/** ground height at (x, z) — the single source of truth for the road surface (mask d = 0..1 depression depth) */
export function roadY(x: number, z: number, d: number): number {
  let y = 0
  if (z >= PLAZA.z0) {
    const k = Math.min(kerbX(-1, z), kerbX(1, z))
    const u = Math.min(1, Math.abs(x) / k)
    y -= 0.022 * u * u // crown
    // gutter channel: a shallow dish in the last 45 cm before the kerb
    const kx = kerbX(x < 0 ? -1 : 1, z)
    const g = smoothstep(kx - 0.5, kx - 0.12, Math.abs(x)) * (1 - smoothstep(kx - 0.12, kx + 0.02, Math.abs(x)))
    y -= 0.02 * g
  } else {
    // plaza: falls gently from the walls toward a central drain line
    y -= 0.03 * Math.pow(Math.min(1, Math.abs(x) / PLAZA.hw), 1.6)
    y -= 0.012 * Math.sin(z * 0.35) * smoothstep(-80, -90, z)
  }
  return y - 0.028 * d
}

/**
 * The road as a handful of large slabs (a few hundred triangles): crowned, falling to a shallow gutter dish beside each kerb, and a gentle
 * fall across the plaza. A dense displaced grid (26 k triangles) was tried first — and measured: thousands of sub-pixel triangles make the
 * heavy asphalt shader run on mostly-empty pixel quads (the whole street frame got ~2× slower in the headless proxy), so the topography that
 * actually reads (crown, gutter, kerb) lives in few big faces and the puddle depressions stay in the water layer.
 */
export function buildGroundGeometry(_mask?: HTMLCanvasElement | null, _fine = true): THREE.BufferGeometry {
  void _mask; void _fine
  // row boundaries: every wall-segment break, the plaza start/end, then ≤ 12 m pieces
  const br = new Set<number>([GROUND.zNear, GROUND.zFar, PLAZA.z0])
  for (const sg of SEGS) { br.add(sg.z0); br.add(sg.z1) }
  const zb = [...br].filter((z) => z <= GROUND.zNear && z >= GROUND.zFar).sort((a, b) => b - a)
  const rows: [number, number][] = []
  for (let i = 0; i < zb.length - 1; i++) {
    const n = Math.max(1, Math.ceil((zb[i] - zb[i + 1]) / 12))
    for (let k = 0; k < n; k++) rows.push([zb[i] - ((zb[i] - zb[i + 1]) * k) / n, zb[i] - ((zb[i] - zb[i + 1]) * (k + 1)) / n])
  }
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const T = 4.2
  let vi = 0
  for (const [za0, zb0] of rows) {
    const za = za0 + 0.01, zbb = zb0 // 1 cm overlap into the previous row hides T-junction cracks between rows with different kerb lines
    const zm = (za0 + zb0) / 2
    let xs: number[]
    if (zm >= PLAZA.z0) {
      const kl = kerbX(-1, zm), kr = kerbX(1, zm)
      xs = [-22, -kl, -kl + 0.12, -kl + 0.5, 0, kr - 0.5, kr - 0.12, kr, 22]
    } else xs = [-22, -12, -6, 0, 6, 12, 22]
    const ys = xs.map((x) => (zm >= PLAZA.z0 ? roadY(Math.abs(x) > 15 ? (x < 0 ? -1 : 1) * 99 : x, zm, 0) : roadY(x, zm, 0)))
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], y0 = ys[i], y1 = ys[i + 1]
      const q = [[x0, y0, za], [x1, y1, za], [x1, y1, zbb], [x0, y0, zbb]]
      for (const [x, y, z] of q) { pos.push(x, y, z); uv.push((x + GROUND.w / 2) / T, (32 - z) / T) }
      idx.push(vi, vi + 1, vi + 3, vi + 1, vi + 2, vi + 3)
      vi += 4
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // the crown/gutter slopes are a few degrees: honest geometry, but as SHADING normals they catch the low sun's glare along the converging gutter lines
  // and the specular aliases into white stipple at distance. Shade mostly as flat asphalt (the micro normal map carries the surface), keep the form.
  const nA = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < nA.count; i++) {
    const x = nA.getX(i) * 0.12, y = nA.getY(i) * 0.12 + 0.88, z = nA.getZ(i) * 0.12
    const l = Math.hypot(x, y, z)
    nA.setXYZ(i, x / l, y / l, z / l)
  }
  return g
}

/** stone kerb blocks along each sidewalk edge + storm-drain grates; two geometries (kerb stone, drain iron) */
export function buildKerbs() {
  const r = rng(3131)
  const stone: THREE.BufferGeometry[] = []
  // cross-section (x across the kerb, y up): street face at local x = 0, top edge rounded; `dir` mirrors it for the right-hand side
  const profile = (w: number, h: number, bevel: number, dir: number) => {
    const P = (x: number, y: number): [number, number] => [x * dir, y]
    const s = new THREE.Shape()
    s.moveTo(...P(0, -0.06))
    s.lineTo(...P(w, -0.06))
    s.lineTo(...P(w, h - 0.01))
    s.lineTo(...P(w - 0.012, h))
    s.lineTo(...P(bevel, h))
    s.lineTo(...P(0.0, h - bevel * 0.55)) // chamfered street-side edge (a straight bevel: a curve here multiplies the triangle count)
    s.lineTo(...P(-0.006, h - bevel))
    s.lineTo(...P(-0.012, -0.06))
    return s
  }
  for (const s of SEGS) {
    const side = s.side
    const xk = side * (s.hw - 0.95) // sidewalk edge
    const len = s.z0 - s.z1
    const n = Math.ceil(len / 1.8)
    for (let i = 0; i < n; i++) {
      const z0 = s.z0 - i * 1.8
      const bl = Math.min(1.8, z0 - s.z1) - 0.012
      if (bl < 0.2) continue
      const w = 0.2 + r() * 0.015
      const h = 0.168 + (r() - 0.5) * 0.006
      const g = new THREE.ExtrudeGeometry(profile(w, h, 0.032 + r() * 0.012, side), { depth: bl, bevelEnabled: false, curveSegments: 1 })
      // chipped top edges: ~1 block in 4 loses a corner (vertices of the street-side top edge pushed in)
      if (r() < 0.28) {
        const pa = g.attributes.position as THREE.BufferAttribute
        const zc = r() * bl, rad = 0.12 + r() * 0.25, depth = 0.01 + r() * 0.02
        for (let v = 0; v < pa.count; v++) {
          if (pa.getY(v) > h - 0.045 && Math.abs(pa.getX(v)) < 0.05) {
            const dz = Math.abs(pa.getZ(v) - zc)
            if (dz < rad) { const f = (1 - dz / rad) * depth; pa.setY(v, pa.getY(v) - f); pa.setX(v, pa.getX(v) + side * f * 0.6) }
          }
        }
      }
      g.translate(xk - side * w, (r() - 0.5) * 0.004, z0 - bl)
      // per-block tone (vertex colour)
      const tone = 0.86 + r() * 0.26
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(tone), 3))
      stone.push(g)
    }
  }
  const stoneGeo = stone.length ? mergeNonIndexed(stone.map((g) => (g.index ? g.toNonIndexed() : g))) : null
  if (stoneGeo) worldUV(stoneGeo, 0.9)

  // storm drains in the gutter, roughly every 36 m per side
  const iron = new GeoBuilder()
  const drains: [number, number][] = []
  for (const s of SEGS) for (let z = s.z0 - 9 - r() * 6; z > s.z1 + 3; z -= 34 + r() * 8) drains.push([s.side, z])
  for (const [side, z] of drains) {
    const kx = kerbX(side as -1 | 1, z)
    const x = side * (kx - 0.26)
    const y = roadY(x, z, 0)
    iron.box(0.56, 0.04, 0.8, x, y - 0.015, z) // cast-iron frame
    iron.box(0.46, 0.012, 0.7, x, y - 0.012, z) // the grate plate (dark: at distance thin bars only alias into sparkle)
    for (let i = -1; i <= 1; i++) iron.box(0.07, 0.03, 0.66, x + i * 0.14, y + 0.0, z) // three broad bars
  }
  return { stone: stoneGeo ? withWhite(stoneGeo) : null, iron: iron.empty ? null : withWhite(iron.build(), 0.9) }
}

function mergeNonIndexed(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0
  for (const p of parts) n += p.attributes.position.count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3)
  let o = 0
  for (const p of parts) {
    const c = p.attributes.position.count
    pos.set(p.attributes.position.array as Float32Array, o * 3)
    nor.set(p.attributes.normal.array as Float32Array, o * 3)
    uv.set(p.attributes.uv.array as Float32Array, o * 2)
    col.set((p.attributes.color?.array as Float32Array) ?? new Float32Array(c * 3).fill(1), o * 3)
    o += c
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
