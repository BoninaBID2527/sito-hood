import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { L, DOOR } from '@/lib/room'
import { makeCanvas } from '@/lib/paint'
import { Batch } from './batch'
import { type Bake, type Occluder, occ } from './bake'
import { buildFloor, buildShell, buildTrim } from './shell'
import * as F from './furniture'
import { PLACE, type Ctx } from './furniture'

/**
 * Static geometry of THE HOODDINO ROOM (room-local frame, see lib/room.ts), merged per material: a handful of draw calls for hundreds of
 * constructed parts. Contact / corner occlusion is retained in vertex colours and a small floor multiply texture.
 * Installed practical-light footprints use a separate irradiance attribute — there are no shadow maps.
 */

export interface RoomGeo {
  walls: THREE.BufferGeometry
  floor: THREE.BufferGeometry
  matte: THREE.BufferGeometry
  satin: THREE.BufferGeometry
  metal: THREE.BufferGeometry
  wood: THREE.BufferGeometry
  fabric: THREE.BufferGeometry
  foam: THREE.BufferGeometry
  glow: THREE.BufferGeometry
  rug: THREE.BufferGeometry | null
  /** floor multiply-bake canvas (contact shadows under furniture and corner occlusion): neutral = 0.5 */
  floorBake: HTMLCanvasElement
}

/** what blocks light near the floor / walls (axis-aligned footprints; r = softness) */
function occluders(level: number): Occluder[] {
  const o: Occluder[] = [
    occ(0.2, -8.13, 2.7, 0.86, 0.72, 0.77, 0.5, 0.55), // desk top
    occ(1.25, -8.15, 0.55, 0.74, 0, 0.72, 0.55, 0.22), // pedestal
    occ(-1.06, -8.13, 0.05, 0.86, 0, 0.72, 0.4, 0.14), // trestle
    occ(-1.5, -8.2, 0.34, 0.3, 0, 0.05, 0.55, 0.14), occ(1.85, -8.15, 0.34, 0.3, 0, 0.05, 0.55, 0.14), // speaker stand bases
    occ(-1.5, -8.2, 0.26, 0.3, 0.84, 1.22, 0.35, 0.25), occ(1.85, -8.15, 0.26, 0.3, 0.84, 1.22, 0.35, 0.25),
    occ(2.45, -8.3, 0.7, 0.5, 0, 0.5, 0.65, 0.3), // road case
    occ(-2.7, -6.4, 0.9, 2.0, 0, 0.46, 0.6, 0.32), occ(-3.0, -6.4, 0.25, 2.0, 0.3, 0.85, 0.5, 0.3), // sofa
    occ(-2.36, -8.1, 0.58, 0.48, 0, 0.62, 0.62, 0.3), // crates
    occ(-1.45, -6.4, 0.9, 0.5, 0.38, 0.42, 0.45, 0.4), // low table
    occ(-1.15, -7.05, 0.52, 0.52, 0.45, 0.58, 0.4, 0.35), // chair
  ]
  if (level === 0) return o.filter((_, i) => i !== 5 && i !== 6)
  return o
}

/** practical lights baked into wall / ceiling vertices (on top of the runtime lights) */
function bakes(level: number): Bake[] {
  const b: Bake[] = [
    // the LED strip's wash on the ceiling and back wall
    { x: 0, y: L.h - 0.12, z: L.zb + 0.1, color: new THREE.Color('#a2b5d1'), i: 0.55, r: 0.9 },
    // picture light over the ALTERCO frame (warm wedge on the wall)
    { x: L.x0 + 0.2, y: 1.93, z: PLACE.alterco.z, color: new THREE.Color('#ffa24d'), i: 2.6, r: 0.55, dir: [-0.5, -0.86, 0], cone: 0.55, soft: 0.4 },
    // two track spots on the wall behind the monitors
    { x: -0.4, y: L.h - 0.2, z: -7.47, color: new THREE.Color('#ffd9a8'), i: 1.5, r: 1.1, dir: [0, -0.7, -0.71], cone: 0.8, soft: 0.2 },
    { x: 0.95, y: L.h - 0.2, z: -7.47, color: new THREE.Color('#ffd9a8'), i: 1.5, r: 1.1, dir: [0, -0.7, -0.71], cone: 0.8, soft: 0.2 },
    // the two ceiling battens' cool light washing the upper side walls, and the warm doorway spill on the first metres of them
    { x: 0.2, y: 2.55, z: -3.6, color: new THREE.Color('#9fb6e8'), i: 1.3, r: 2.0 },
    { x: 0.2, y: 2.55, z: -6.6, color: new THREE.Color('#9fb6e8'), i: 0.6, r: 2.0 },
    { x: 0, y: 1.7, z: -1.5, color: new THREE.Color('#ffa868'), i: 1.5, r: 1.6 },
  ]
  return level >= 1 ? b : b.slice(1, 2)
}

/** floor multiply map: 0.5 = neutral (shader multiplies by 2). Soft footprints of everything standing on / over the floor and wall-edge occlusion. */
function floorBake(size: number, list: Occluder[]) {
  const { canvas, ctx } = makeCanvas(size, size)
  const W = L.x1 - L.x0, D = L.zf - L.zb
  const px = (x: number) => ((x - L.x0) / W) * size, py = (z: number) => ((z - L.zb) / D) * size
  const mx = size / W // pixels per metre (x); z is stretched slightly, fine for soft blobs
  ctx.fillStyle = 'rgb(128,128,128)'
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'
  // wall-edge occlusion
  const e = mx * 0.45
  const strip = (x0: number, y0: number, x1: number, y1: number, w: number, h: number) => {
    const gg = ctx.createLinearGradient(x0, y0, x1, y1)
    gg.addColorStop(0, 'rgba(0,0,0,0.5)'); gg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gg
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h)
  }
  strip(0, 0, 0, e, size, e)
  strip(0, size, 0, size - e, size, e)
  strip(0, 0, e, 0, e, size)
  strip(size, 0, size - e, 0, e, size)
  // furniture footprints: blurred shadows (the rect is drawn off-canvas, only its shadow lands)
  const OFF = size * 3
  for (const o of list) {
    if (o.y0 > 1.2) continue
    const blur = (o.r ?? 0.3) * mx * (1 + o.y0 * 1.5)
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${Math.min(1, (o.k ?? 0.5) * (o.y0 > 0.1 ? 0.8 : 1.3))})`
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = OFF
    ctx.fillStyle = '#000'
    ctx.fillRect(px(o.x0) - OFF, py(o.z0), px(o.x1) - px(o.x0), py(o.z1) - py(o.z0))
    ctx.restore()
  }
  return canvas
}

const cable = (b: Batch, pts: [number, number, number][], r: number, col = '#0b0b0c') => b.tube(pts.map((p) => new THREE.Vector3(...p)), r, col, { ao: 0.25 })

export function buildRoomGeometry(level: number): RoomGeo {
  const matte = new Batch(0, 0.5), satin = new Batch(0, 0.45), metal = new Batch(0, 0.35)
  const wood = new Batch(1.6, 0.4), fabric = new Batch(0.35, 0.3), foam = new Batch(0.3, 0.3), glow = new Batch(0, 0)
  const c: Ctx = { matte, satin, metal, wood, fabric, foam, glow, level }
  const occl = occluders(level)
  const env = { occ: occl, bakes: bakes(level) }
  const { x0, x1, zf, zb, h } = L

  /* envelope */
  const shell = buildShell(env)
  matte.raw(shell.ceiling)
  buildTrim(matte, satin, metal)
  const floor = buildFloor(level)

  /* constructed things */
  F.ceiling(c)
  F.desk(c)
  F.display(c, PLACE.hero.x, PLACE.hero.y, PLACE.hero.z, PLACE.hero.w, PLACE.hero.h, { foot: 0.26, neck: 0.2 })
  F.display(c, PLACE.daw.x, PLACE.daw.y, PLACE.daw.z, PLACE.daw.w, PLACE.daw.h, { foot: 0.22, neck: 0.18 })
  F.studioHardware(c)
  F.keyboard(c)
  F.deskObjects(c)
  F.speaker(c, PLACE.spkL.x, PLACE.spkL.z, PLACE.spkL.ry)
  F.speaker(c, PLACE.spkR.x, PLACE.spkR.z, PLACE.spkR.ry)
  F.chair(c)
  if (level >= 1) F.micStand(c)
  F.cases(c)
  F.crtUnit(c)
  F.lounge(c)
  const hw = F.wallHardware(c)
  if (level >= 1) F.shelf(c)

  /* acoustic treatment */
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) F.foamPanel(c, -2.55 + i * 0.62, 1.3 + j * 0.62, zb, 0)
  for (let i = 0; i < 3; i++) F.foamPanel(c, x0, 0.45, -1.75 - i * 0.62, Math.PI / 2)
  if (level >= 1) for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) F.foamPanel(c, 1.25 + i * 0.62, 0.95 + j * 0.62, zf, Math.PI)
  F.fabricPanel(c, 0.9, 2.18, zb, 0, 1.2, 0.9, '#6d2428')
  F.fabricPanel(c, -0.55, 2.18, zb, 0, 1.2, 0.9, '#3d4550')
  F.fabricPanel(c, x1, 0.62, -6.9, -Math.PI / 2, 1.2, 1.0, '#3d4550')
  F.fabricPanel(c, x0, 1.9, -2.05, Math.PI / 2, 1.0, 0.9, '#6d2428')

  /* mounted pictures: frames, mats, a picture light */
  frames(c)

  /* cables (each one runs from a real source to a real destination, resting on the floor / desk) */
  if (level >= 1) {
    const T = PLACE.deskTop
    // mains: outlet → plug → along the skirting → up behind the desk to the power strip
    cable(matte, [[hw.plug.x, hw.plug.y, hw.plug.z], [hw.plug.x + 0.01, 0.2, zb + 0.05], [hw.plug.x + 0.1, 0.02, zb + 0.07], [-0.95, 0.012, zb + 0.06], [-0.5, 0.012, zb + 0.05], [-0.3, 0.4, zb + 0.07], [-0.2, T - 0.13, zb + 0.14]], 0.0085)
    matte.box(0.05, 0.045, 0.03, hw.plug.x, hw.plug.y, hw.plug.z + 0.012, '#0f0f10', { r: 0.006, ao: 0 })
    // speakers: down the stands, across the boards to the desk
    cable(matte, [[PLACE.spkL.x - 0.02, 0.84, zb + 0.28], [PLACE.spkL.x - 0.05, 0.4, zb + 0.2], [PLACE.spkL.x - 0.1, 0.012, zb + 0.16], [-1.25, 0.012, zb + 0.07], [-0.7, 0.012, zb + 0.06], [-0.45, 0.25, zb + 0.08], [-0.4, T - 0.13, zb + 0.16]], 0.007)
    cable(matte, [[PLACE.spkR.x + 0.02, 0.84, zb + 0.4], [PLACE.spkR.x + 0.05, 0.4, zb + 0.34], [PLACE.spkR.x, 0.012, zb + 0.25], [1.7, 0.012, zb + 0.1], [1.2, 0.012, zb + 0.06], [0.7, 0.3, zb + 0.07], [0.5, T - 0.13, zb + 0.14]], 0.007)
    // the mic cable: stand base → across the floor → up the pedestal's side to the desk
    cable(matte, [[2.0, 0.012, -7.05], [1.85, 0.012, -7.4], [1.72, 0.012, -7.8], [1.62, 0.3, -7.9], [1.55, 0.7, -7.9], [1.4, T - 0.13, -8.0]], 0.0065)
    // on the desk: the keyboard's USB lead and the lamp's cord run to the back edge and drop behind
    cable(matte, [[0.4, T + 0.04, -7.78], [0.42, T + 0.004, -8.0], [0.34, T + 0.004, -8.3], [0.3, T + 0.003, -8.5], [0.3, 0.6, zb + 0.02]], 0.0035)
    cable(matte, [[-1.02, T + 0.02, -8.4], [-1.03, T + 0.004, -8.48], [-1.04, 0.5, zb + 0.03], [-1.0, 0.012, zb + 0.06]], 0.004)
  }

  /* the rug (a thin dark body + the printed top) */
  const rugG = level >= 1 ? new THREE.PlaneGeometry(2.0, 1.5) : null
  if (rugG) { rugG.rotateX(-Math.PI / 2); rugG.rotateY(Math.PI / 2); rugG.translate(-1.9, 0.0135, -6.4) }
  if (level >= 1) matte.box(1.5, 0.012, 2.0, -1.9, 0.006, -6.4, '#2c1315', { r: 0.004, ao: 0.1 })

  // practical-light bake for the furniture's colours near the desk (the lamp pool) lives in the runtime lights; here: AO against walls
  const wallAO = (p: THREE.Vector3, _n: THREE.Vector3, col: THREE.Color) => {
    const dz = Math.max(0, 0.22 - (p.z - zb)) / 0.22, dxL = Math.max(0, 0.22 - (p.x - x0)) / 0.22, dxR = Math.max(0, 0.22 - (x1 - p.x)) / 0.22
    const k = 1 - 0.35 * Math.max(dz, dxL, dxR) * Math.exp(-Math.max(0, p.y - 0.4) / 1.2)
    col.multiplyScalar(k)
  }
  const sealed = (b: Batch, fx?: typeof wallAO) => b.build(fx)!
  const geo = {
    walls: shell.walls,
    floor,
    matte: sealed(matte, wallAO),
    satin: sealed(satin, wallAO),
    metal: sealed(metal),
    wood: sealed(wood, wallAO),
    fabric: sealed(fabric, wallAO),
    foam: sealed(foam),
    glow: sealed(glow),
    rug: rugG,
    floorBake: floorBake(level >= 2 ? 512 : 256, occl),
  }
  for (const g of Object.values(geo)) {
    if (g instanceof THREE.BufferGeometry && !g.hasAttribute('roomBake')) g.setAttribute('roomBake', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3))
  }
  void DOOR
  return geo
}

/** wall pictures: the portrait in a frame with a mat, the documentary print pinned as paper, the ALTERCO artwork in a slim frame with its picture light */
function frames(c: Ctx) {
  const { portrait, live, alterco } = PLACE
  // WHO IS HOODDINO? portrait (right wall, faces −x): black wood frame, cream mat, the photo recessed behind it
  c.matte.group(portrait.x, portrait.y, portrait.z, -Math.PI / 2, () => {
    const W = 1.18, H = 1.38, f = 0.045, mw = 0.065
    c.satin.ab(-W / 2, W / 2, -H / 2, H / 2, 0, 0.012, '#0e0e10', { ao: 0 })
    for (const [bx, by, bw, bh] of [[0, H / 2 - f / 2, W, f], [0, -H / 2 + f / 2, W, f], [-W / 2 + f / 2, 0, f, H - 2 * f], [W / 2 - f / 2, 0, f, H - 2 * f]] as const)
      c.wood.box(bw, bh, 0.032, bx, by, 0.016, '#2a1f17', { r: 0.004, ao: 0, tile: 0.5 })
    const iw = W - 2 * f, ih = H - 2 * f // mat window outer
    for (const [bx, by, bw, bh] of [[0, ih / 2 - mw / 2, iw, mw], [0, -ih / 2 + mw / 2, iw, mw], [-iw / 2 + mw / 2, 0, mw, ih - 2 * mw], [iw / 2 - mw / 2, 0, mw, ih - 2 * mw]] as const)
      c.matte.box(bw, bh, 0.01, bx, by, 0.017, '#d9d4c6', { ao: 0 })
    c.matte.ab(-iw / 2, iw / 2, -ih / 2, ih / 2, 0.012, 0.0125, '#bfb9aa', { ao: 0 }) // the print's paper behind the window
    // two small hangers (brass) on the wall above the frame — what it hangs from
    c.metal.cyl(0.006, 0.006, 0.012, -0.3, H / 2 + 0.05, 0.006, '#b09a5a', { rx: Math.PI / 2, n: 8, ao: 0 })
    c.metal.cyl(0.006, 0.006, 0.012, 0.3, H / 2 + 0.05, 0.006, '#b09a5a', { rx: Math.PI / 2, n: 8, ao: 0 })
  })
  // LIVE print (left wall, faces +x): a paper sheet taped up (the photo plane sits on it)
  c.matte.group(live.x, live.y, live.z, Math.PI / 2, () => {
    c.matte.box(1.04, 1.22, 0.005, 0, 0, 0.0025, '#d4cdbb', { ao: 0, jit: 0 })
  })
  // ALTERCO (left wall): slim black frame, white mat, the artwork recessed; picture light above on a short arm
  c.satin.group(alterco.x, alterco.y, alterco.z, Math.PI / 2, () => {
    const W = 0.72, f = 0.02, mw = 0.03
    c.satin.ab(-W / 2, W / 2, -W / 2, W / 2, 0, 0.01, '#0d0d0f', { ao: 0 })
    for (const [bx, by, bw, bh] of [[0, W / 2 - f / 2, W, f], [0, -W / 2 + f / 2, W, f], [-W / 2 + f / 2, 0, f, W - 2 * f], [W / 2 - f / 2, 0, f, W - 2 * f]] as const)
      c.satin.box(bw, bh, 0.026, bx, by, 0.013, '#101012', { r: 0.002, ao: 0 })
    const iw = W - 2 * f
    for (const [bx, by, bw, bh] of [[0, iw / 2 - mw / 2, iw, mw], [0, -iw / 2 + mw / 2, iw, mw], [-iw / 2 + mw / 2, 0, mw, iw - 2 * mw], [iw / 2 - mw / 2, 0, mw, iw - 2 * mw]] as const)
      c.matte.box(bw, bh, 0.008, bx, by, 0.014, '#e4dfd2', { ao: 0 })
    // picture light: wall plate, arm, head with its glowing strip
    const ty = W / 2 + 0.09
    c.metal.ab(-0.025, 0.025, ty - 0.03, ty + 0.03, 0, 0.01, '#2a2419', { r: 0.002, ao: 0 })
    c.metal.rod([0, ty, 0.008], [0, ty + 0.01, 0.2], 0.005, '#8d7a45', { n: 6, ao: 0 })
    c.metal.box(0.012, 0.03, 0.34, 0, ty + 0.02, 0.2, '#8d7a45', { r: 0.004, ao: 0 })
    c.metal.box(0.34, 0.03, 0.012, 0, ty + 0.0, 0.2, '#6f5f35', { r: 0.004, ao: 0 })
    c.glow.box(0.3, 0.004, 0.012, 0, ty - 0.016, 0.2, '#ffb36a', { i: 1.5, ao: 0 })
  })
}

/** world-of-the-room constants shared with the scene (door aperture size) */
export const APERTURE = { w: DOOR.w, h: DOOR.h }
void mergeGeometries
