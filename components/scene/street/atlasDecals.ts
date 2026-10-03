import * as THREE from 'three'
import { rng } from '@/lib/math'
import type { Cell } from '@/lib/graffiti'
import { streetMat } from './materials'

/** one placement of an atlas cell on a surface (already in world space) */
export interface Placement {
  cell: Cell
  /** world position of the decal centre */
  pos: [number, number, number]
  /** y rotation (wall facing) */
  ry: number
  /** extra rotations: rx for floor decals, rz for roll */
  rx?: number
  rz?: number
  /** width in metres (height follows the cell aspect) */
  w: number
  /** 0..1.4 brightness (paint age / dirt) */
  tint?: number
  /** paper bow (m), corner curl (m) */
  bend?: number
  curl?: number
  seed?: number
}

/** A plane geometry that shows exactly one atlas cell (for single, interactive marks). */
export function cellGeometry(cell: Cell) {
  const g = new THREE.PlaneGeometry(1, 1)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cell.uv[0] + uv.getX(i) * cell.uv[2], cell.uv[1] + uv.getY(i) * cell.uv[3])
  uv.needsUpdate = true
  return g
}

/** Atlas decal material — painted/pasted onto masonry (torn edges, ageing, brick-breakup in the street shader). */
export function atlasMaterial(map: THREE.Texture, o: { paper?: boolean; seed?: number } = {}) {
  return streetMat({
    map, transparent: true, depthWrite: false, roughness: o.paper ? 0.88 : 0.95, aoBase: 0.55, macro: 0.85, decal: true, atlas: true, seed: o.seed ?? 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
}

/** Soft rounded-rect shadow used under paper (contact shadow). */
export function shadowTexture() {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  ctx.filter = 'none'
  ctx.shadowColor = 'rgba(0,0,0,1)'
  ctx.shadowBlur = 7
  ctx.fillStyle = '#000'
  ctx.fillRect(14, 14, S - 28, S - 28)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Builds one InstancedMesh for a batch of placements sharing a texture. Returns the mesh + the instance geometry (to dispose). */
export function buildAtlasMesh(items: Placement[], mat: THREE.Material, o: { segs?: number; order?: number } = {}) {
  const n = items.length
  const geo = new THREE.PlaneGeometry(1, 1, o.segs ?? 1, o.segs ?? 1)
  const rect = new Float32Array(n * 4)
  const meta = new Float32Array(n * 3)
  const im = new THREE.InstancedMesh(geo, mat, n)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3()
  const col = new THREE.Color()
  items.forEach((it, i) => {
    const h = it.w / it.cell.aspect
    p.set(...it.pos)
    q.setFromEuler(eu.set(it.rx ?? 0, it.ry, it.rz ?? 0, 'YXZ'))
    sc.set(it.w, h, 1)
    im.setMatrixAt(i, m4.compose(p, q, sc))
    rect.set(it.cell.uv, i * 4)
    const r = rng((it.seed ?? i) + 7)
    meta.set([it.bend ?? 0, r(), it.curl ?? 0], i * 3)
    const t = it.tint ?? 1
    im.setColorAt(i, col.setRGB(t, t, t))
  })
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4))
  geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 3))
  im.instanceMatrix.needsUpdate = true
  if (im.instanceColor) im.instanceColor.needsUpdate = true
  im.frustumCulled = false
  im.renderOrder = o.order ?? 1
  return { mesh: im, geo }
}
