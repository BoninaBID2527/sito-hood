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
export const GROUND = { w: 44, zNear: 28, zFar: -124, cz: -48 }

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
  return y - 0.045 * d
}

export function buildGroundGeometry(mask: HTMLCanvasElement | null, fine = true): THREE.BufferGeometry {
  // grid lines: fine in the alley, coarse behind the walls
  const xs: number[] = []
  const fx = fine ? 0.25 : 0.5
  for (let x = -22; x < -12; x += 2) xs.push(x)
  for (let x = -12; x < -7; x += 0.5) xs.push(x)
  for (let x = -7; x < 7; x += fx) xs.push(Math.round(x * 1000) / 1000)
  for (let x = 7; x < 12; x += 0.5) xs.push(x)
  for (let x = 12; x <= 22.001; x += 2) xs.push(x)
  const zs: number[] = []
  const fz = fine ? 0.5 : 1
  for (let z = GROUND.zNear; z >= GROUND.zFar - 0.001; z -= fz) zs.push(z)
  const nx = xs.length, nz = zs.length
  let img: ImageData | null = null
  if (mask) { const c = mask.getContext('2d'); if (c) img = c.getImageData(0, 0, mask.width, mask.height) }
  const R = (x: number, z: number) => {
    if (!img) return 0
    const u = (x + 14) / 28, v = (20 - z) / 142
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0
    const px = Math.min(img.width - 1, Math.floor(u * img.width)), py = Math.min(img.height - 1, Math.floor(v * img.height))
    return img.data[(py * img.width + px) * 4] / 255
  }
  const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2)
  const idx: number[] = []
  const T = 4.2
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i], z = zs[j]
      const d = smoothstep(0.38, 0.9, R(x, z))
      const k = j * nx + i
      pos[k * 3] = x; pos[k * 3 + 1] = roadY(x, z, d); pos[k * 3 + 2] = z
      uv[k * 2] = (x + GROUND.w / 2) / T
      uv[k * 2 + 1] = (32 - z) / T
    }
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
    idx.push(a, b, c, b, d, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
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
    s.quadraticCurveTo(...P(0.0, h), ...P(-0.004, h - bevel))
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
      const g = new THREE.ExtrudeGeometry(profile(w, h, 0.032 + r() * 0.012, side), { depth: bl, bevelEnabled: false, curveSegments: 3 })
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
    iron.box(0.56, 0.05, 0.8, x, y - 0.01, z) // frame
    for (let i = -3; i <= 3; i++) iron.box(0.03, 0.03, 0.72, x + i * 0.075, y + 0.012, z) // bars
    iron.box(0.5, 0.01, 0.74, x, y - 0.08, z) // the dark throat below the bars
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
