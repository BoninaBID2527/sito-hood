import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { worldUV } from '@/lib/geo'

/**
 * Merged geometry for ONE material of the room: primitives are transformed into room space, given a vertex colour (albedo × baked contact
 * darkening) and optionally metre-scaled UVs (so wood grain / fabric weave keep a physical scale on any part). One batch = one draw call.
 */
export interface PartOpts {
  /** bevel radius → rounded box (1 segment = a chamfer-like soft edge; rs=2 for fabric / cushions) */
  r?: number
  rs?: number
  seg?: [number, number, number]
  rx?: number
  ry?: number
  rz?: number
  s?: [number, number, number]
  /** colour multiplier (HDR for emissives) */
  i?: number
  /** floor-contact darkening of vertices close to y = 0 (0..1) */
  ao?: number
  /** per-part random brightness jitter */
  jit?: number
  /** uv: tile size in metres (batch default if omitted); swap = grain along the other axis */
  tile?: number
  swap?: boolean
  /** cylinders: radial segments, open ended */
  n?: number
  open?: boolean
}

/** group transform applied after each part's own (compound objects: chair, TV, speakers …) — shared by every batch, so one group() call places parts of several materials */
let GRP: THREE.Matrix4 | null = null

let jseed = 7
const jr = () => { jseed = (jseed * 16807) % 2147483647; return jseed / 2147483647 }

export type VertexFn = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, part: number) => void

export class Batch {
  private parts: THREE.BufferGeometry[] = []
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private sc = new THREE.Vector3()
  private p = new THREE.Vector3()
  private c = new THREE.Color()
  constructor(private tile = 0, private ao = 0.45) {}

  /** place + colour any geometry */
  geo(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, o: PartOpts = {}) {
    this.p.set(x, y, z)
    this.q.setFromEuler(this.e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ'))
    this.sc.set(...(o.s ?? [1, 1, 1]))
    this.m.compose(this.p, this.q, this.sc)
    if (GRP) this.m.premultiply(GRP)
    g.applyMatrix4(this.m)
    this.c.set(color).multiplyScalar(o.i ?? 1)
    if (o.jit) this.c.multiplyScalar(1 + (jr() - 0.5) * o.jit)
    const n = g.attributes.position.count
    const pos = g.attributes.position
    const col = new Float32Array(n * 3)
    const pre = g.getAttribute('color') as THREE.BufferAttribute | undefined // a part may bring its own gradient (foam, drawers)
    const ao = o.ao ?? this.ao
    for (let i = 0; i < n; i++) {
      let f = 1
      if (ao > 0) {
        const t = Math.min(1, Math.max(0, pos.getY(i) / 0.22))
        f = 1 - ao * (1 - t * t * (3 - 2 * t))
      }
      const k = f
      col[i * 3] = this.c.r * k * (pre ? pre.getX(i) : 1); col[i * 3 + 1] = this.c.g * k * (pre ? pre.getY(i) : 1); col[i * 3 + 2] = this.c.b * k * (pre ? pre.getZ(i) : 1)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('roomBake', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const tile = o.tile ?? this.tile
    if (tile > 0) {
      worldUV(g, tile)
      if (o.swap) {
        const uv = g.attributes.uv
        for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setXY(i, uv.getY(i), u) }
      }
    }
    if (!g.index) g.setIndex([...Array(n).keys()])
    this.parts.push(g)
    return this
  }
  /** everything built inside `fn` is placed in a local frame (origin x,y,z, yaw ry, pitch rx) */
  group(x: number, y: number, z: number, ry: number, fn: () => void, rx = 0, rz = 0) {
    const prev = GRP
    const g = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1))
    GRP = prev ? prev.clone().multiply(g) : g
    fn()
    GRP = prev
    return this
  }
  /** add a geometry that already carries position / normal / uv / color / index */
  raw(g: THREE.BufferGeometry) { this.parts.push(g); return this }
  /** box centred at x,y,z */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    let g: THREE.BufferGeometry
    if (o.r && o.r > 0) g = new RoundedBoxGeometry(w, h, d, o.rs ?? 1, Math.min(o.r, Math.min(w, h, d) * 0.48))
    else g = new THREE.BoxGeometry(w, h, d, ...(o.seg ?? [1, 1, 1]))
    return this.geo(g, color, x, y, z, o)
  }
  /** box from extents */
  ab(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    return this.box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, color, o)
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    return this.geo(new THREE.CylinderGeometry(rt, rb, h, o.n ?? 12, 1, o.open ?? false), color, x, y, z, o)
  }
  lathe(profile: [number, number][], x: number, y: number, z: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    return this.geo(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), o.n ?? 14), color, x, y, z, o)
  }
  /** a round rod / tube between two points */
  rod(a: [number, number, number], b: [number, number, number], r: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b)
    const len = A.distanceTo(B)
    const g = new THREE.CylinderGeometry(r, r, len, o.n ?? 8, 1, o.open ?? false)
    const dir = B.clone().sub(A).normalize()
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
    const mid = A.clone().add(B).multiplyScalar(0.5)
    return this.geo(g, color, mid.x, mid.y, mid.z, { ...o, rx: 0, ry: 0, rz: 0 })
  }
  /** a rectangular bar between two points (square section) */
  bar(a: [number, number, number], b: [number, number, number], w: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b)
    const len = A.distanceTo(B)
    const g = o.r ? new RoundedBoxGeometry(w, len, d, 1, Math.min(o.r, Math.min(w, d) * 0.45)) : new THREE.BoxGeometry(w, len, d)
    const dir = B.clone().sub(A).normalize()
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
    const mid = A.clone().add(B).multiplyScalar(0.5)
    return this.geo(g, color, mid.x, mid.y, mid.z, { ...o, rx: 0, ry: 0, rz: 0 })
  }
  /** a flexible cable / hose along a smooth curve */
  tube(pts: THREE.Vector3[], r: number, color: THREE.ColorRepresentation, o: PartOpts & { steps?: number } = {}) {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), o.steps ?? pts.length * 8, r, 5, false)
    return this.geo(g, color, 0, 0, 0, o)
  }
  get empty() { return this.parts.length === 0 }
  get count() { return this.parts.length }
  /** merge → one geometry; `fx` may modify each vertex colour (baked AO / lights) */
  build(fx?: VertexFn) {
    if (!this.parts.length) return null
    const g = mergeGeometries(this.parts, false)!
    this.parts.forEach((p) => p.dispose())
    this.parts = []
    if (fx) {
      const pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color as THREE.BufferAttribute
      const P = new THREE.Vector3(), N = new THREE.Vector3(), C = new THREE.Color()
      for (let i = 0; i < pos.count; i++) {
        P.fromBufferAttribute(pos, i); N.fromBufferAttribute(nor, i); C.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace)
        fx(P, N, C, i)
        col.setXYZ(i, C.r, C.g, C.b)
      }
    }
    g.computeBoundingSphere()
    return g
  }
}
