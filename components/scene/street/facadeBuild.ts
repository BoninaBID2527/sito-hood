import * as THREE from 'three'

/**
 * V3.6 — walls with real openings.
 *
 * A facade used to be one flat plane with window/door pictures floating 5 cm in front of it. Here the wall is built as a surface with
 * rectangular holes, and every hole gets four reveal faces (the thickness of the wall) that run back to the sash/door plane, so a
 * window is a shaft CUT INTO the wall: it gets parallax, a shadowed inside, and a believable silhouette at grazing angles.
 * Ambient occlusion is baked into vertex colours (open at the wall face, closed at the back of the shaft).
 */
export interface Hole {
  /** z range (z0 = near/larger, z1 = far/smaller) and y range of the opening */
  z0: number
  z1: number
  y0: number
  y1: number
  /** wall thickness the opening cuts through (m) */
  depth: number
}

export interface WallBuild {
  side: -1 | 1
  /** x of the wall face, near/far z of the segment, height */
  x: number
  zNear: number
  zFar: number
  h: number
  holes: Hole[]
  /** texture tile size in metres (matches the old plane mapping) */
  tile?: number
}

export function wallWithOpenings(b: WallBuild): THREE.BufferGeometry {
  const { side, x: xw, zNear, zFar, h, holes } = b
  const tile = b.tile ?? 2.4
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = []
  const U = (z: number) => (side === -1 ? (zNear - z) / tile : (z - zFar) / tile)
  const V = (y: number) => y / tile
  let vi = 0
  const quad = (p: number[][], t: number[][], c: number[], n: [number, number, number]) => {
    // orientation from the geometric normal
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2]
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2]
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0
    for (let i = 0; i < 4; i++) {
      pos.push(p[i][0], p[i][1], p[i][2]); nor.push(n[0], n[1], n[2]); uv.push(t[i][0], t[i][1]); col.push(c[i], c[i], c[i])
    }
    if (!flip) idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3)
    else idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2)
    vi += 4
  }
  const nx = -side

  // ── the wall face: strips between hole edges, free y-intervals only
  const zs = new Set<number>([zNear, zFar])
  for (const hl of holes) { zs.add(Math.min(zNear, hl.z0)); zs.add(Math.max(zFar, hl.z1)) }
  const zl = [...zs].sort((a, b2) => b2 - a)
  for (let i = 0; i < zl.length - 1; i++) {
    const za = zl[i], zb = zl[i + 1]
    if (za - zb < 1e-4) continue
    const zm = (za + zb) / 2
    const blocked: [number, number][] = []
    for (const hl of holes) if (zm < hl.z0 && zm > hl.z1) blocked.push([hl.y0, hl.y1])
    blocked.sort((a, b2) => a[0] - b2[0])
    let y = 0
    const free: [number, number][] = []
    for (const [a, b2] of blocked) { if (a > y + 1e-4) free.push([y, a]); y = Math.max(y, b2) }
    if (y < h - 1e-4) free.push([y, h])
    for (const [ya, yb] of free) {
      // 2 mm of overlap into the next strip hides T-junction cracks (identical surface, so nothing z-fights visibly)
      const zb2 = zb - 0.002
      quad(
        [[xw, ya, za], [xw, ya, zb2], [xw, yb, zb2], [xw, yb, za]],
        [[U(za), V(ya)], [U(zb2), V(ya)], [U(zb2), V(yb)], [U(za), V(yb)]],
        [1, 1, 1, 1], [nx, 0, 0],
      )
    }
  }

  // ── reveals: the four faces of each shaft, shaded dark toward the back
  for (const hl of holes) {
    const xb = xw + side * hl.depth
    const F = 0.78, B = 0.26
    const d0 = 0, d1 = hl.depth / tile
    // faces on z (left/right jambs)
    quad([[xw, hl.y0, hl.z0], [xb, hl.y0, hl.z0], [xb, hl.y1, hl.z0], [xw, hl.y1, hl.z0]], [[d0, V(hl.y0)], [d1, V(hl.y0)], [d1, V(hl.y1)], [d0, V(hl.y1)]], [F, B, B, F], [0, 0, -1])
    quad([[xw, hl.y0, hl.z1], [xb, hl.y0, hl.z1], [xb, hl.y1, hl.z1], [xw, hl.y1, hl.z1]], [[d0 + 0.37, V(hl.y0)], [d1 + 0.37, V(hl.y0)], [d1 + 0.37, V(hl.y1)], [d0 + 0.37, V(hl.y1)]], [F, B, B, F], [0, 0, 1])
    // head (ceiling) and sill (floor)
    quad([[xw, hl.y1, hl.z0], [xb, hl.y1, hl.z0], [xb, hl.y1, hl.z1], [xw, hl.y1, hl.z1]], [[U(hl.z0), d0], [U(hl.z0), d1], [U(hl.z1), d1], [U(hl.z1), d0]], [F * 0.8, B * 0.8, B * 0.8, F * 0.8], [0, -1, 0])
    quad([[xw, hl.y0, hl.z0], [xb, hl.y0, hl.z0], [xb, hl.y0, hl.z1], [xw, hl.y0, hl.z1]], [[U(hl.z0), d0 + 0.2], [U(hl.z0), d1 + 0.2], [U(hl.z1), d1 + 0.2], [U(hl.z1), d0 + 0.2]], [F, B * 1.1, B * 1.1, F], [0, 1, 0])
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

/** give any geometry a white vertex-colour attribute so it can merge with baked-AO geometry */
export function withWhite(g: THREE.BufferGeometry, v = 1) {
  if (g.attributes.color) return g
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3).fill(v)
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}
