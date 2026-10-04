import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { tileUV, worldUV } from '@/lib/geo'
import { L, DOOR } from '@/lib/room'

/**
 * Static geometry of THE HOODDINO ROOM (room-local frame, see lib/room.ts), merged into a handful of meshes.
 * Everything that shares a material is ONE geometry with vertex colours → one draw call each.
 */

/** collect primitives with a vertex colour, merge once */
export class Batch {
  private parts: THREE.BufferGeometry[] = []
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private s = new THREE.Vector3(1, 1, 1)
  private p = new THREE.Vector3()
  private c = new THREE.Color()

  private put(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, intensity = 1) {
    this.p.set(x, y, z)
    this.q.setFromEuler(this.e.set(rx, ry, rz))
    this.m.compose(this.p, this.q, this.s)
    g.applyMatrix4(this.m)
    this.c.set(color).multiplyScalar(intensity)
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set([this.c.r, this.c.g, this.c.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    if (!g.index) {
      const idx: number[] = []
      for (let i = 0; i < n; i++) idx.push(i)
      g.setIndex(idx)
    }
    this.parts.push(g)
    return this
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o: { rx?: number; ry?: number; rz?: number; i?: number } = {}) {
    return this.put(new THREE.BoxGeometry(w, h, d), color, x, y, z, o.rx, o.ry, o.rz, o.i)
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o: { seg?: number; rx?: number; ry?: number; rz?: number; i?: number } = {}) {
    return this.put(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 10), color, x, y, z, o.rx, o.ry, o.rz, o.i)
  }
  tube(pts: THREE.Vector3[], r: number, color: THREE.ColorRepresentation) {
    return this.put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, r, 5, false), color, 0, 0, 0)
  }
  get empty() { return this.parts.length === 0 }
  build() {
    if (!this.parts.length) return null
    const g = mergeGeometries(this.parts, false)!
    this.parts.forEach((p) => p.dispose())
    this.parts = []
    return g
  }
}

/** a wall plane facing `dir` ('+z' faces +z …) spanning [a0,a1] along the wall and [y0,y1] up, with metre-scaled UVs */
function wallPlane(face: '+x' | '-x' | '+z' | '-z', fixed: number, a0: number, a1: number, y0: number, y1: number, tile = 2.4) {
  const w = Math.abs(a1 - a0), h = y1 - y0
  const g = new THREE.PlaneGeometry(w, h)
  tileUV(g, w, h, tile)
  const mid = (a0 + a1) / 2, yc = (y0 + y1) / 2
  if (face === '+z') g.translate(mid, yc, fixed)
  else if (face === '-z') { g.rotateY(Math.PI); g.translate(mid, yc, fixed) }
  else if (face === '+x') { g.rotateY(Math.PI / 2); g.translate(fixed, yc, mid) }
  else { g.rotateY(-Math.PI / 2); g.translate(fixed, yc, mid) }
  return g
}

export interface RoomGeo {
  /** painted block walls (textured) */
  walls: THREE.BufferGeometry
  floor: THREE.BufferGeometry
  /** everything lit and vertex-coloured (ceiling, pipes, desk carcass, speakers, chair, sofa, crates, frames …) */
  solid: THREE.BufferGeometry
  /** cables + black hardware */
  dark: THREE.BufferGeometry | null
  /** LED strips and fluorescent fixtures (unlit, intensity > 1 → bloom) */
  glow: THREE.BufferGeometry
  foam: THREE.BufferGeometry
  fabricRed: THREE.BufferGeometry
  fabricSlate: THREE.BufferGeometry
  wood: THREE.BufferGeometry
  rug: THREE.BufferGeometry | null
}

export function buildRoomGeometry(level: number): RoomGeo {
  const { x0, x1, zf, zb, h } = L
  const hv = 0.75 // half width of the airlock opening in the front wall
  const open = 2.5

  /* ── walls ── */
  const wall: THREE.BufferGeometry[] = [
    wallPlane('+z', zb, x0, x1, 0, h),
    wallPlane('+x', x0, zb, zf, 0, h),
    wallPlane('-x', x1, zb, zf, 0, h),
    wallPlane('-z', zf, x0, -hv, 0, h),
    wallPlane('-z', zf, hv, x1, 0, h),
    wallPlane('-z', zf, -hv, hv, open, h),
  ]
  const walls = mergeGeometries(wall.map((g) => (g.index ? g : (g.setIndex([...Array(g.attributes.position.count).keys()]), g))), false)!
  wall.forEach((g) => g.dispose())

  const fl = new THREE.PlaneGeometry(x1 - x0, zf - zb)
  fl.rotateX(-Math.PI / 2)
  fl.translate((x0 + x1) / 2, 0, (zf + zb) / 2)
  tileUV(fl, x1 - x0, zb - zf, 2.4)
  // plane is built from +y normal with uv v along z: re-map to metres
  worldUV(fl, 2.4)

  /* ── solid, vertex-coloured ── */
  const s = new Batch()
  // ceiling + beams + pipes (industrial verticality, imperfect)
  s.box(x1 - x0, 0.08, zf - zb, 0, h + 0.04, (zf + zb) / 2, '#16171a')
  for (const z of [-2.8, -5.2, -7.6]) s.box(x1 - x0 - 0.1, 0.16, 0.12, 0, h - 0.08, z, '#202125')
  s.cyl(0.07, 0.07, zf - zb - 0.3, -2.75, h - 0.2, (zf + zb) / 2, '#4b4640', { rx: Math.PI / 2 })
  s.cyl(0.045, 0.045, zf - zb - 0.3, -2.5, h - 0.14, (zf + zb) / 2, '#3b3f44', { rx: Math.PI / 2 })
  s.cyl(0.05, 0.05, 3.2, 2.9, h - 0.18, -4.6, '#6b2a22', { rx: Math.PI / 2 })
  s.box(0.5, 0.3, 0.7, 1.3, h - 0.2, -3.3, '#26282c')
  // skirting along the walls
  s.box(0.04, 0.12, zf - zb, x0 + 0.02, 0.06, (zf + zb) / 2, '#14161a')
  s.box(0.04, 0.12, zf - zb, x1 - 0.02, 0.06, (zf + zb) / 2, '#14161a')

  /* ── workstation ── */
  // desk carcass (the worn top is a separate textured batch)
  s.box(0.05, 0.72, 0.86, -1.1, 0.36, -8.15, '#1d1b1a')
  s.box(0.05, 0.72, 0.86, 1.5, 0.36, -8.15, '#1d1b1a')
  s.box(2.6, 0.5, 0.03, 0.2, 0.46, -8.55, '#17161a')
  s.box(2.55, 0.04, 0.6, 0.2, 0.2, -8.25, '#222125')
  // monitors (bezels) + stands
  s.box(0.66, 0.4, 0.04, -0.52, 1.14, -8.3, '#0b0b0d')
  s.cyl(0.015, 0.015, 0.22, -0.52, 0.86, -8.4, '#2a2b30')
  s.box(0.2, 0.012, 0.14, -0.52, 0.78, -8.36, '#2a2b30')
  s.box(0.48, 0.76, 0.045, 0.5, 1.2, -8.29, '#0b0b0d')
  s.cyl(0.018, 0.018, 0.26, 0.5, 0.88, -8.42, '#2a2b30')
  s.box(0.22, 0.012, 0.16, 0.5, 0.78, -8.38, '#2a2b30')
  // monitor speakers on floor stands
  for (const [sx, sz] of [[-1.5, -8.2], [1.85, -8.15]] as const) {
    s.cyl(0.024, 0.024, 0.82, sx, 0.41, sz, '#26272b')
    s.box(0.3, 0.02, 0.26, sx, 0.01, sz, '#1d1e22')
    s.box(0.26, 0.38, 0.3, sx, 1.02, sz, '#17181b')
    s.cyl(0.095, 0.095, 0.02, sx, 0.97, sz + 0.155, '#0b0b0d', { rx: Math.PI / 2, seg: 16 })
    s.cyl(0.03, 0.03, 0.02, sx, 1.13, sz + 0.155, '#303137', { rx: Math.PI / 2, seg: 10 })
  }
  // keyboard body + audio interface
  s.box(1.0, 0.045, 0.28, 0.0, 0.795, -7.92, '#101012', { rx: -0.06 })
  s.box(0.24, 0.07, 0.2, -0.98, 0.815, -8.05, '#1b1c20')
  for (let i = 0; i < 3; i++) s.cyl(0.014, 0.014, 0.02, -1.05 + i * 0.07, 0.86, -7.97, '#8e9096', { seg: 8 })
  // desk lamp (the warm motivated light)
  s.cyl(0.07, 0.07, 0.02, -1.0, 0.785, -8.38, '#101012', { seg: 12 })
  s.box(0.015, 0.45, 0.015, -1.0, 1.0, -8.38, '#1a1a1c', { rz: -0.35 })
  s.box(0.015, 0.34, 0.015, -0.88, 1.2, -8.38, '#1a1a1c', { rz: 0.9 })
  s.cyl(0.04, 0.09, 0.1, -0.75, 1.25, -8.38, '#1d1d20', { seg: 12, rz: 1.1 })
  // phone stand (TikTok object) — the phone itself is a screen mesh
  s.box(0.08, 0.012, 0.09, 1.18, 0.78, -7.98, '#18181b', { ry: 0.3 })
  // chair
  s.cyl(0.04, 0.04, 0.4, 0.1, 0.25, -7.12, '#1b1b1d')
  s.box(0.5, 0.08, 0.5, 0.1, 0.5, -7.12, '#2a2528', { ry: 0.22 })
  s.box(0.46, 0.5, 0.07, 0.04, 0.82, -6.88, '#2a2528', { ry: 0.22, rx: -0.12 })
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; s.box(0.34, 0.025, 0.04, 0.1 + Math.cos(a) * 0.17, 0.05, -7.12 + Math.sin(a) * 0.17, '#17171a', { ry: -a }) }
  // dark-floor crates / flight case
  s.box(0.6, 0.45, 0.45, 2.45, 0.225, -8.2, '#25262a')
  s.box(0.5, 0.4, 0.4, 2.55, 0.65, -8.2, '#2e2f33', { ry: 0.2 })

  /* ── lounge / personal corner (back-left) ── */
  // worn sofa against the left wall, facing the room
  s.box(0.85, 0.42, 1.9, -2.72, 0.21, -6.4, '#2e2420')
  s.box(0.24, 0.5, 1.9, -3.03, 0.55, -6.4, '#33281f')
  s.box(0.82, 0.14, 0.62, -2.62, 0.49, -6.9, '#3a2b24', { ry: 0.02 })
  s.box(0.82, 0.14, 0.62, -2.62, 0.49, -5.9, '#352823', { ry: -0.03 })
  s.box(0.82, 0.62, 0.2, -2.35, 0.43, -7.36, '#2c221e')
  s.box(0.82, 0.62, 0.2, -2.35, 0.43, -5.46, '#2c221e')
  // crates holding the CRT
  s.box(0.55, 0.32, 0.45, -2.35, 0.16, -8.15, '#3a2f20')
  s.box(0.55, 0.3, 0.45, -2.38, 0.47, -8.12, '#2e2619', { ry: 0.12 })
  s.box(0.5, 0.46, 0.5, -2.36, 0.85, -8.1, '#27262a', { ry: 0.5 })
  s.box(0.46, 0.4, 0.3, -2.45, 0.85, -8.35, '#222126', { ry: 0.5 })
  // low table
  s.box(0.9, 0.04, 0.5, -1.45, 0.4, -6.4, '#3b2c1f')
  for (const [dx, dz] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) s.box(0.04, 0.4, 0.04, -1.45 + dx, 0.2, -6.4 + dz, '#141416')
  // frame for the ALTERCO print + the warm LED rectangle behind it (glow batch carries the light)
  s.box(0.05, 0.7, 0.7, -3.17, 1.48, -6.4, '#101012')

  /* ── bio / live wall furniture: the thin boxes the prints are mounted on ── */
  s.box(0.04, 1.3, 1.1, 3.17, 1.17, -5.45, '#cfc8b6') // portrait paper mount (the photo sits on it)
  s.box(0.03, 1.26, 1.04, -3.17, 1.25, -3.2, '#cfc8b6')

  /* ── high-detail props (hidden on the mobile tier) ── */
  if (level >= 1) {
    // shelving with records / cases on the front wall
    s.box(1.2, 0.04, 0.26, -2.2, 1.7, zf - 0.14, '#2b2318')
    s.box(1.2, 0.04, 0.26, -2.2, 2.1, zf - 0.14, '#2b2318')
    for (let i = 0; i < 9; i++) s.box(0.03, 0.31, 0.22, -2.7 + i * 0.1, 1.87, zf - 0.14, ['#c8302b', '#e8e0cc', '#1d4fb8', '#e0b840', '#14161c'][i % 5])
    // mug + papers on the desk
    s.cyl(0.04, 0.035, 0.09, -0.3, 0.825, -7.98, '#d9d1c0', { seg: 10 })
    s.box(0.2, 0.004, 0.28, 1.0, 0.777, -8.1, '#e9e3d4', { ry: 0.4 })
    // headphones over the monitor
    s.box(0.2, 0.012, 0.04, 0.92, 1.18, -8.15, '#0e0e10', { rz: 0.0 })
    // mic stand
    s.cyl(0.012, 0.012, 1.4, 1.35, 0.8, -7.3, '#1c1c1f')
    s.cyl(0.03, 0.03, 0.12, 1.35, 1.5, -7.3, '#2b2b30', { seg: 12 })
    s.box(0.2, 0.02, 0.2, 1.35, 0.01, -7.3, '#16161a')
  }
  const solid = s.build()!

  /* ── cables + black hardware ── */
  const d = new Batch()
  if (level >= 1) {
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    d.tube([P(0.4, 0.78, -8.5), P(0.7, 0.2, -8.4), P(1.4, 0.01, -8.0), P(1.9, 0.01, -7.2)], 0.012, '#0a0a0b')
    d.tube([P(-0.6, 0.78, -8.5), P(-0.9, 0.2, -8.3), P(-1.3, 0.01, -7.8), P(-1.6, 0.01, -7.1)], 0.012, '#0a0a0b')
    d.tube([P(0.2, 0.74, -8.55), P(0.3, 0.3, -8.55), P(0.6, 0.01, -8.5), P(2.0, 0.01, -8.45)], 0.018, '#111113')
    d.tube([P(1.35, 0.01, -7.3), P(1.0, 0.01, -7.6), P(0.7, 0.4, -8.3)], 0.01, '#0a0a0b')
    // power strip
    d.box(0.4, 0.03, 0.06, 0.6, 0.01, -8.45, '#17171a')
  }
  const dark = d.build()

  /* ── glow (LED strips, fixtures, equipment LEDs) ── */
  const g = new Batch()
  // blue LED strip along the back wall's top edge, deep red under the desk front, warm orange frame around the ALTERCO print
  g.box(x1 - x0 - 0.2, 0.025, 0.03, 0, h - 0.07, zb + 0.06, '#3a6bff', { i: 1.8 })
  g.box(2.55, 0.014, 0.014, 0.2, 0.69, -7.74, '#ff2a1c', { i: 2.2 })
  const fx = -3.12, fz = -6.4
  g.box(0.02, 0.9, 0.02, fx, 1.48, fz - 0.45, '#ff8a2a', { i: 2.0 })
  g.box(0.02, 0.9, 0.02, fx, 1.48, fz + 0.45, '#ff8a2a', { i: 2.0 })
  g.box(0.02, 0.02, 0.92, fx, 1.93, fz, '#ff8a2a', { i: 2.0 })
  g.box(0.02, 0.02, 0.92, fx, 1.03, fz, '#ff8a2a', { i: 2.0 })
  // fluorescent fixtures (cool-white), one slightly dead
  g.box(0.16, 0.05, 1.3, 0.2, h - 0.12, -3.6, '#dce8ff', { i: 1.7 })
  g.box(0.16, 0.05, 1.3, 0.2, h - 0.12, -6.6, '#dce8ff', { i: 0.7 })
  // equipment LEDs (interface, keyboard, speakers)
  for (let i = 0; i < 4; i++) g.box(0.012, 0.012, 0.004, -1.06 + i * 0.05, 0.84, -7.945, i === 2 ? '#ff3a2a' : '#44ff88', { i: 2.4 })
  for (const sx of [-1.5, 1.85]) g.box(0.014, 0.014, 0.004, sx + 0.09, 0.86, (sx < 0 ? -8.2 : -8.15) + 0.155, '#44aaff', { i: 2.4 })
  // the daylight/street glow in the doorway is a gradient mesh in RoomWorld (not part of this batch)
  const glow = g.build()!

  /* ── foam / fabric / wood ── */
  const foam: THREE.BufferGeometry[] = []
  const panel = (list: THREE.BufferGeometry[], w: number, hh: number, depth: number, x: number, y: number, z: number, ry = 0, tile = 0.5) => {
    const b = new THREE.BoxGeometry(w, hh, depth)
    worldUV(b, tile)
    b.rotateY(ry)
    b.translate(x, y, z)
    list.push(b)
  }
  // foam: back-left wall behind the lounge, left wall low, right wall low (beside the bio sheet), front wall
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) panel(foam, 0.6, 0.6, 0.07, -2.55 + i * 0.62, 1.3 + j * 0.62, zb + 0.04)
  for (let i = 0; i < 3; i++) panel(foam, 0.07, 0.6, 0.6, x0 + 0.04, 0.45, -1.75 - i * 0.62)
  // front wall, right of the airlock: a stack of foam (the first thing the camera passes on the way in)
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) panel(foam, 0.6, 0.6, 0.07, 1.25 + i * 0.62, 0.95 + j * 0.62, zf - 0.04)
  const fabricRed: THREE.BufferGeometry[] = []
  const fabricSlate: THREE.BufferGeometry[] = []
  panel(fabricRed, 1.2, 0.9, 0.05, 0.9, 2.18, zb + 0.03, 0, 1)
  panel(fabricSlate, 1.2, 0.9, 0.05, -0.55, 2.18, zb + 0.03, 0, 1)
  panel(fabricSlate, 0.05, 1.0, 1.2, x1 - 0.03, 0.62, -6.9, 0, 1)
  panel(fabricRed, 0.05, 0.9, 1.0, x0 + 0.03, 1.9, -2.05, 0, 1)
  const wood: THREE.BufferGeometry[] = []
  panel(wood, 2.7, 0.05, 0.9, 0.2, 0.745, -8.15, 0, 1.2) // desk top
  panel(wood, 0.9, 0.04, 0.5, -1.45, 0.42, -6.4, 0, 1.2)
  const rugG = level >= 1 ? new THREE.PlaneGeometry(2.0, 1.5) : null
  if (rugG) { rugG.rotateX(-Math.PI / 2); rugG.rotateY(Math.PI / 2); rugG.translate(-1.9, 0.006, -6.4); worldUV(rugG, 0.8) }
  const merge = (list: THREE.BufferGeometry[]) => {
    const m = mergeGeometries(list, false)!
    list.forEach((g2) => g2.dispose())
    return m
  }
  return {
    walls, floor: fl, solid, dark, glow,
    foam: merge(foam), fabricRed: merge(fabricRed), fabricSlate: merge(fabricSlate), wood: merge(wood), rug: rugG,
  }
}

/** world-of-the-room constants shared with the scene (door aperture size) */
export const APERTURE = { w: DOOR.w, h: DOOR.h }
