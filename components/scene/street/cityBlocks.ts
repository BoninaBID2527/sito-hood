import * as THREE from 'three'
import { rng } from '@/lib/math'
import { tagBuilding } from '@/effects/TowerMaterial'

/**
 * V3.6 — the near/mid city as BUILDINGS, not boxes: every tower is a stack of setbacks with a cornice band, rooftop plant
 * (bulkhead, chimney stacks, a wooden water tank on a steel stand on some), masts and a service stair house. Depth bands:
 *   NEAR  (z −130 … −200): full set of parts, tower-material facades (its own floor height, bay width, state per window)
 *   MID   (z −200 … −290): setbacks + a crown, no small plant
 *   (FAR is the 2.5-D silhouette layers in Backdrop.tsx)
 * All parts are merged into ONE geometry (one draw call); the per-building facade parameters ride in the `aSeed` attribute.
 */
export interface CityPart { geo: THREE.BufferGeometry }

export function buildCity(seed = 5150, plaza = true): THREE.BufferGeometry {
  const r = rng(seed)
  const parts: THREE.BufferGeometry[] = []
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, tag: [number, number, number, number]) => {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, y, z)
    parts.push(tagBuilding(g, ...tag))
  }
  const plain = (w: number, h: number, d: number, x: number, y: number, z: number, shade = 0.0) => {
    // un-windowed plant: style > 1 = flat grey in the tower material's "side" branch is not available → use a high seed with dead facade
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, y, z)
    parts.push(tagBuilding(g, 0.93 + shade, 40, 40, 0.1)) // enormous floor/bay size ⇒ one blank cell ⇒ solid wall
  }
  const rows: { z: number; xs: number[]; hMin: number; hMax: number; detail: boolean }[] = [
    { z: -140, xs: [-30, 32], hMin: 34, hMax: 48, detail: true },
    { z: -168, xs: [-44, -20, 26, 46], hMin: 40, hMax: 62, detail: true },
    { z: -198, xs: [-66, -40, 34, 60], hMin: 48, hMax: 82, detail: true },
    { z: -232, xs: [-86, -54, -26, 28, 58, 90], hMin: 56, hMax: 98, detail: false },
    { z: -270, xs: [-100, -70, -40, 40, 72, 104], hMin: 64, hMax: 118, detail: false },
  ]
  if (!plaza) rows.length = 0
  let id = 0
  for (const row of rows) {
    for (const x0 of row.xs) {
      id++
      const w0 = r.range(18, 32), d0 = r.range(16, 28)
      const x = x0 + r.range(-4, 4), z = row.z + r.range(-6, 6)
      const h0 = r.range(row.hMin, row.hMax)
      const style = r() < 0.4 ? r.range(0, 0.3) : r() < 0.6 ? r.range(0.36, 0.64) : r.range(0.7, 0.98)
      const floorH = style > 0.67 ? r.range(3.6, 4.2) : r.range(3.2, 3.8)
      const bayW = style > 0.67 ? r.range(1.6, 2.4) : r.range(2.6, 3.4)
      const tag: [number, number, number, number] = [0.07 + id * 0.113, floorH, bayW, style]
      // main shaft + up to three setbacks, each narrower and offset toward the back
      let w = w0, d = d0, y = 0, h = h0, cx = x, cz = z
      add(w, h, d, cx, y + h / 2, cz, tag)
      y += h
      const steps = r.int(0, row.detail ? 3 : 2)
      for (let k = 0; k < steps; k++) {
        const nw = w * r.range(0.66, 0.86), nd = d * r.range(0.66, 0.86), nh = r.range(6, 16) + (row.detail ? 4 : 0)
        cx += (w - nw) * r.range(-0.3, 0.3); cz += (d - nd) * 0.25
        // cornice band under the setback
        add(w + 0.8, 0.9, d + 0.8, cx - (cx - x) * 0.0, y - 0.1, z, tag)
        w = nw; d = nd
        add(w, nh, d, cx, y + nh / 2, cz, tag)
        y += nh
      }
      add(w + 0.9, 1.0, d + 0.9, cx, y + 0.45, cz, tag) // crown cornice
      if (row.detail) {
        // rooftop plant: bulkhead, chimney stacks, tank, mast
        plain(r.range(4, 7), r.range(3, 4.6), r.range(4, 7), cx + r.range(-w * 0.25, w * 0.25), y + 2.0, cz + r.range(-d * 0.25, d * 0.25), 0.01)
        for (let q = 0; q < r.int(1, 3); q++) plain(r.range(1.4, 2.2), r.range(2.6, 4.8), r.range(1.4, 2.2), cx + r.range(-w * 0.4, w * 0.4), y + 1.8, cz + r.range(-d * 0.4, d * 0.4), 0.02)
        if (r() < 0.45) {
          // wooden water tank on a steel stand
          const tx = cx + r.range(-w * 0.3, w * 0.3), tz = cz + r.range(-d * 0.3, d * 0.3)
          const tank = new THREE.CylinderGeometry(2.1, 2.1, 3.6, 14)
          tank.translate(tx, y + 4.6 + 1.8, tz)
          parts.push(tagBuilding(tank, 0.95, 40, 40, 0.1))
          const roof = new THREE.ConeGeometry(2.4, 1.6, 14)
          roof.translate(tx, y + 4.6 + 3.6 + 0.8, tz)
          parts.push(tagBuilding(roof, 0.96, 40, 40, 0.1))
          for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as const) {
            const leg = new THREE.BoxGeometry(0.22, 4.6, 0.22)
            leg.translate(tx + dx, y + 2.3, tz + dz)
            parts.push(tagBuilding(leg, 0.97, 40, 40, 0.1))
          }
        }
        if (r() < 0.55) plain(0.35, r.range(8, 20), 0.35, cx + r.range(-w * 0.3, w * 0.3), y + 6, cz + r.range(-d * 0.3, d * 0.3), 0.03)
      } else if (r() < 0.5) {
        plain(0.4, r.range(10, 26), 0.4, cx, y + 7, cz, 0.03)
      }
    }
  }
  // merge
  let n = 0
  for (const p of parts) n += p.index ? p.attributes.position.count : p.attributes.position.count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), seedA = new Float32Array(n * 4)
  const idx: number[] = []
  let o = 0
  for (const p of parts) {
    const c = p.attributes.position.count
    pos.set(p.attributes.position.array as Float32Array, o * 3)
    nor.set(p.attributes.normal.array as Float32Array, o * 3)
    uv.set(p.attributes.uv.array as Float32Array, o * 2)
    seedA.set(p.attributes.aSeed.array as Float32Array, o * 4)
    if (p.index) for (let i = 0; i < p.index.count; i++) idx.push(p.index.getX(i) + o)
    else for (let i = 0; i < c; i++) idx.push(i + o)
    o += c
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 4))
  g.setIndex(idx)
  return g
}
