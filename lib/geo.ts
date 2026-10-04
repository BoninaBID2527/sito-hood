import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/** Tiny geometry builder: collect transformed primitives, merge once → 1 draw call. */
export class GeoBuilder {
  private parts: THREE.BufferGeometry[] = []
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private s = new THREE.Vector3(1, 1, 1)
  private p = new THREE.Vector3()

  private place(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    this.p.set(x, y, z)
    this.q.setFromEuler(this.e.set(rx, ry, rz))
    this.m.compose(this.p, this.q, this.s)
    g.applyMatrix4(this.m)
    this.parts.push(g)
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    this.place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz)
    return this
  }
  /** a box with softened edges (r = edge radius): hero hardware catches the light on its edges instead of reading as a cut-out */
  rbox(w: number, h: number, d: number, x: number, y: number, z: number, r = 0.012, rx = 0, ry = 0, rz = 0) {
    const rr = Math.min(r, Math.min(w, h, d) * 0.45)
    this.place(new RoundedBoxGeometry(w, h, d, 2, rr), x, y, z, rx, ry, rz)
    return this
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 8, rx = 0, ry = 0, rz = 0) {
    this.place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz)
    return this
  }
  plane(w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    this.place(new THREE.PlaneGeometry(w, h), x, y, z, rx, ry, rz)
    return this
  }
  add(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    this.place(g, x, y, z, rx, ry, rz)
    return this
  }
  get empty() {
    return this.parts.length === 0
  }
  build() {
    // normalise attribute sets so everything can merge
    for (const g of this.parts) {
      if (g.index) continue
      const idx: number[] = []
      for (let i = 0; i < g.attributes.position.count; i++) idx.push(i)
      g.setIndex(idx)
    }
    const merged = mergeGeometries(this.parts, false)!
    this.parts.forEach((g) => g.dispose())
    this.parts = []
    return merged
  }
}

/** Scale a plane's UVs so a texture tile = `tile` metres. */
export function tileUV(g: THREE.BufferGeometry, w: number, h: number, tile: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile)
  uv.needsUpdate = true
  return g
}

/** Planar world-space UVs (per dominant normal axis) so textures keep a constant physical scale on any box. */
export function worldUV(g: THREE.BufferGeometry, tile: number, ox = 0, oy = 0, oz = 0) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const nor = g.attributes.normal as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i))
    if (ax >= ay && ax >= az) uv.setXY(i, z / tile, y / tile)
    else if (az >= ay) uv.setXY(i, x / tile, y / tile)
    else uv.setXY(i, x / tile, z / tile)
  }
  uv.needsUpdate = true
  return g
}
