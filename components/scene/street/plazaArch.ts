import * as THREE from 'three'
import { rng } from '@/lib/math'
import { GeoBuilder, worldUV } from '@/lib/geo'
import { wallFaceZ, wallWithOpenings, withWhite, type Hole, type HoleX } from './facadeBuild'
import { PA } from './plazaLayout'
import { allWindows, PLAZA } from './layout'
import { roadY } from './groundBuild'

/** matches Facades.tsx (sash depth behind the wall face, unit window height) */
const WIN_DEPTH = 0.28
const WIN_H = 1.55

export type PlazaKey = 'rl' | 'rr' | 'end' | 'stone' | 'steel' | 'roof' | 'wood' | 'cap' | 'rubber' | 'crate' | 'glow' | 'seam' | 'patch' | 'iron'
export interface PlazaParts {
  /** brick façades, one geometry per material key */
  walls: { key: 'rl' | 'rr' | 'end'; geo: THREE.BufferGeometry }[]
  /** every other part, merged by material key */
  parts: Partial<Record<PlazaKey, THREE.BufferGeometry>>
  /** loading-dock shutters / doors on the rear façades: textured planes (variant index into A.shutters / A.doors) */
  doors: { kind: 'shutter' | 'door'; variant: number; x: number; y: number; z: number; w: number; h: number; ry?: number }[]
  /** practical lamps (light spill halos are drawn around them) */
  lamps: { p: [number, number, number]; s: number; o: number }[]
}

const faceZHoles = (pred: (d: ReturnType<typeof allWindows>[number]) => boolean): HoleX[] =>
  allWindows().filter((d) => d.face === 'z' && pred(d)).map((d) => {
    const hh = (WIN_H * d.h) / 2
    return { xa: d.x - d.w / 2, xb: d.x + d.w / 2, y0: d.y - hh, y1: d.y + hh, depth: WIN_DEPTH }
  })

const passageHoles = (side: -1 | 1): Hole[] =>
  allWindows().filter((d) => !d.face && d.side === side && Math.abs(d.x) === PA.passHW && d.z < PA.zFace - 0.5).map((d) => {
    const hh = (WIN_H * d.h) / 2
    return { z0: d.z + d.w / 2, z1: d.z - d.w / 2, y0: d.y - hh, y1: d.y + hh, depth: WIN_DEPTH }
  })

export function buildPlazaArch(): PlazaParts {
  const r = rng(7700)
  const stone = new GeoBuilder(), steel = new GeoBuilder(), roof = new GeoBuilder(), wood = new GeoBuilder(), cap = new GeoBuilder()
  const rubber = new GeoBuilder(), crate = new GeoBuilder(), glow = new GeoBuilder(), iron = new GeoBuilder()
  const brickRL = new GeoBuilder(), brickRR = new GeoBuilder(), brickEnd = new GeoBuilder()
  const doors: PlazaParts['doors'] = []
  const Z = PA.zFace
  const walls: PlazaParts['walls'] = []

  // ── façades with real openings ───────────────────────────────────────────────────────────────────────────────────────────────
  const dockXs = [-9.0, -6.0]
  const rlHoles: HoleX[] = [
    ...faceZHoles((d) => d.z === Z && d.x < 0),
    ...dockXs.map((x) => ({ xa: x - 1.4, xb: x + 1.4, y0: PA.dockY, y1: PA.dockY + 3.1, depth: 0.22 })),
  ]
  walls.push({ key: 'rl', geo: wallFaceZ({ x0: PA.RL.x0, x1: PA.RL.x1, z: Z, h: PA.RL.h, holes: rlHoles }) })
  const rrHoles: HoleX[] = [
    ...faceZHoles((d) => d.z === Z && d.x > 0),
    { xa: 4.85, xb: 6.0, y0: 0, y1: 2.35, depth: 0.24 },
    { xa: 7.95, xb: 10.85, y0: 0, y1: 2.8, depth: 0.2 },
  ]
  walls.push({ key: 'rr', geo: wallFaceZ({ x0: PA.RR.x0, x1: PA.RR.x1, z: Z, h: PA.RR.h, holes: rrHoles }) })
  // set-back top floors (built from y = 0 and lifted: the lower part hides behind the main block)
  const top = wallFaceZ({ x0: PA.RR.topX0, x1: PA.RR.x1, z: PA.RR.topZ, h: PA.RR.topH - PA.RR.h, holes: faceZHoles((d) => d.z === PA.RR.topZ).map((h) => ({ ...h, y0: h.y0 - PA.RR.h, y1: h.y1 - PA.RR.h })) })
  top.translate(0, PA.RR.h, 0)
  walls.push({ key: 'rr', geo: top })
  walls.push({ key: 'end', geo: wallFaceZ({ x0: PA.END.x0, x1: PA.END.x1, z: PA.endZ, h: PA.END.h, holes: faceZHoles((d) => d.z === PA.endZ) }) })
  // passage walls (they face each other)
  walls.push({ key: 'rl', geo: wallWithOpenings({ side: -1, x: -PA.passHW, zNear: Z, zFar: PA.endZ, h: PA.RL.h, holes: passageHoles(-1) }) })
  walls.push({ key: 'rr', geo: wallWithOpenings({ side: 1, x: PA.passHW, zNear: Z, zFar: PA.endZ, h: PA.RR.topH, holes: passageHoles(1) }) })

  // doors on the rear façades (textured planes set into their openings)
  dockXs.forEach((x, i) => doors.push({ kind: 'shutter', variant: i % 3, x, y: PA.dockY + 1.4, z: Z - 0.2 + 0.02, w: 2.8, h: 2.8 }))
  doors.push({ kind: 'door', variant: 1, x: 5.425, y: 1.18, z: Z - 0.24 + 0.02, w: 1.15, h: 2.35 })
  doors.push({ kind: 'shutter', variant: 2, x: 9.4, y: 1.4, z: Z - 0.2 + 0.02, w: 2.9, h: 2.8 })

  // ── relief on the rear faces (outward = +z) ────────────────────────────────────────────────────────────────────────────────
  const cornice = (b: GeoBuilder, x0: number, x1: number, y: number, z: number) => {
    const len = x1 - x0, xc = (x0 + x1) / 2
    for (const [d, hh, yy] of [[0.13, 0.2, y - 0.96], [0.25, 0.2, y - 0.76], [0.37, 0.22, y - 0.55]] as const) b.add(worldUV(new THREE.BoxGeometry(len + 0.1, hh, d), 2.4), xc, yy, z + d / 2)
    stone.box(len + 0.2, 0.38, 0.52, xc, y - 0.25, z + 0.26)
    b.add(worldUV(new THREE.BoxGeometry(len, 0.95, 0.34), 2.4), xc, y + 0.47, z - 0.17) // parapet
    stone.box(len + 0.1, 0.08, 0.48, xc, y + 0.99, z - 0.12) // coping
  }
  const belt = (x0: number, x1: number, y: number, z: number, d = 0.16) => stone.box(x1 - x0, 0.24, d, (x0 + x1) / 2, y, z + d / 2 - 0.02)
  // Physical relief for the alley-mouth returns, facing into the plaza.
  for (const side of [-1, 1] as const) {
    const inner = side < 0 ? 4.8 : 4.3;
    const width = PLAZA.hw - inner, cx = side * (inner + width / 2);
    const height = side < 0 ? 24 : 25;
    stone.box(width, .38, .20, cx, .19, PA.frontZ - .08);
    stone.box(width + .1, .14, .44, cx, height + .07, PA.frontZ);
    for (const y of [3.3, 9.5, 16.1]) stone.box(width, .12, .12, cx, y, PA.frontZ - .05);
    for (const x of [side * (inner + .3), side * (PLAZA.hw - .3)]) {
      stone.box(.26, height, .15, x, height / 2, PA.frontZ - .055);
      steel.cyl(.055, .055, height - .4, x - side * .23, height / 2, PA.frontZ - .20, 8);
      for (let y = 1.1; y < height; y += 2.5) steel.box(.18, .04, .10, x - side * .23, y, PA.frontZ - .15);
    }
  }
  // RL
  cornice(brickRL, PA.RL.x0, PA.RL.x1, PA.RL.h, Z)
  for (const y of [4.9, 8.0, 11.4, 14.8]) belt(PA.RL.x0, PA.RL.x1, y, Z, y === 4.9 ? 0.2 : 0.12)
  for (const x of [-12.7, -9.7, -6.7, -4.0]) {
    const ph = PA.RL.h - 1.1
    brickRL.add(worldUV(new THREE.BoxGeometry(0.5, ph, 0.2), 2.4), x, PA.dockY + (ph - PA.dockY) / 2 + 0.16, Z + 0.1)
    stone.box(0.62, 0.1, 0.26, x, PA.RL.h - 0.97, Z + 0.13)
  }
  // RR
  cornice(brickRR, PA.RR.x0, PA.RR.x1, PA.RR.h, Z)
  cornice(brickRR, PA.RR.topX0, PA.RR.x1, PA.RR.topH, PA.RR.topZ)
  for (const y of [4.4, 8.0, 11.35, 14.7, 18.0]) belt(PA.RR.x0, PA.RR.x1, y, Z, y === 4.4 ? 0.2 : 0.12)
  for (const x of [4.0, 6.7, 9.7, 12.7]) {
    const ph = PA.RR.h - 1.1
    brickRR.add(worldUV(new THREE.BoxGeometry(0.5, ph, 0.2), 2.4), x, 0.16 + ph / 2, Z + 0.1)
    stone.box(0.62, 0.1, 0.26, x, PA.RR.h - 0.97, Z + 0.13)
  }
  belt(PA.RR.topX0, PA.RR.x1, 22.4, PA.RR.topZ, 0.12)
  // passage walls: string courses + cornices (x-facing)
  for (const [side, h] of [[-1, PA.RL.h], [1, PA.RR.topH]] as const) {
    const len = Z - PA.endZ, zc = (Z + PA.endZ) / 2, xw = side * PA.passHW, inw = -side
    stone.box(0.16, 0.24, len, xw + inw * 0.04, 4.38, zc)
    for (let y = 7.8; y < h - 2.2; y += 3.4) stone.box(0.1, 0.13, len, xw + inw * 0.04, y, zc)
    const bb = side === -1 ? brickRL : brickRR
    for (const [d, hh, y] of [[0.13, 0.2, h - 0.96], [0.25, 0.2, h - 0.76], [0.37, 0.22, h - 0.55]] as const) bb.add(worldUV(new THREE.BoxGeometry(d, hh, len + 0.1), 2.4), xw + inw * d / 2, y, zc)
    stone.box(0.52, 0.38, len + 0.2, xw + inw * 0.26, h - 0.25, zc)
    bb.add(worldUV(new THREE.BoxGeometry(0.34, 0.95, len), 2.4), xw + side * 0.17, h + 0.47, zc)
    stone.box(0.48, 0.08, len + 0.1, xw + side * 0.17 + inw * 0.04, h + 0.99, zc)
  }
  // end façade cornice + parapet
  cornice(brickEnd, PA.END.x0, PA.END.x1, PA.END.h, PA.endZ)
  belt(PA.END.x0, PA.END.x1, 3.1, PA.endZ, 0.16)

  // ── the loading dock (RL): platform, canopy, rails, stairs, bumpers, lamps, goods ───────────────────────────────────────
  const dx0 = -11.8, dx1 = -3.9, dz1 = Z + PA.dockDepth
  stone.box(dx1 - dx0, PA.dockY, PA.dockDepth, (dx0 + dx1) / 2, PA.dockY / 2, Z + PA.dockDepth / 2) // concrete platform
  steel.box(dx1 - dx0 + 0.04, 0.09, 0.09, (dx0 + dx1) / 2, PA.dockY - 0.02, dz1 - 0.02) // steel nosing angle
  for (let x = dx0 + 0.9; x < dx1 - 0.3; x += 1.2) steel.cyl(0.024, 0.024, 0.95, x, PA.dockY + 0.475, dz1 - 0.12, 6)
  steel.box(dx1 - dx0 - 1.1, 0.04, 0.04, (dx0 + 1.1 + dx1) / 2, PA.dockY + 0.95, dz1 - 0.12)
  steel.box(dx1 - dx0 - 1.1, 0.04, 0.04, (dx0 + 1.1 + dx1) / 2, PA.dockY + 0.5, dz1 - 0.12)
  for (let k = 0; k < 4; k++) stone.box(1.2, 0.287 * (k + 1), 0.3, dx0 + 0.6, 0.287 * (k + 1) / 2, dz1 + 0.15 + (3 - k) * 0.3) // stair (steps down toward the plaza)
  steel.box(0.04, 0.9, 1.3, dx0 + 1.22, 0.95, dz1 + 0.6, 0, 0, 0.0)
  // canopy over the doors
  steel.box(7.9, 0.12, 1.3, -7.55, 4.78, Z + 0.65)
  for (const x of [-11.3, -3.9]) steel.cyl(0.03, 0.03, 1.5, x, 4.5, Z + 0.62, 6, 0, 0, 0.62)
  // dock bumpers + door housings + lamps
  for (const x of dockXs) {
    rubber.box(0.5, 0.42, 0.2, x - 1.45, PA.dockY - 0.4, Z + 0.1)
    rubber.box(0.5, 0.42, 0.2, x + 1.45, PA.dockY - 0.4, Z + 0.1)
    steel.box(3.1, 0.36, 0.3, x, PA.dockY + 3.32, Z + 0.15) // roller box
    steel.box(0.16, 3.1, 0.14, x - 1.5, PA.dockY + 1.55, Z + 0.08) // guide rails
    steel.box(0.16, 3.1, 0.14, x + 1.5, PA.dockY + 1.55, Z + 0.08)
    steel.box(0.3, 0.2, 0.3, x, 4.45, Z + 0.28) // lamp bracket housing
    glow.box(0.22, 0.07, 0.22, x, 4.33, Z + 0.28) // the lamp itself
  }
  // goods on the dock: pallets with boxes, one wrapped stack, a hand truck
  const palletAt = (x: number, z: number, n: number, yaw = 0) => {
    wood.box(1.2, 0.14, 0.8, x, PA.dockY + 0.07, z, 0, yaw, 0)
    for (let k = 0; k < n; k++) crate.box(0.55 + r() * 0.1, 0.4 + r() * 0.1, 0.55, x + (r() - 0.5) * 0.4, PA.dockY + 0.34 + k * 0.45, z + (r() - 0.5) * 0.2, 0, yaw + (r() - 0.5) * 0.2, 0)
  }
  palletAt(-4.9, Z + 1.2, 4, 0.1)
  palletAt(-7.55, Z + 1.5, 2, -0.15)
  palletAt(-10.6, Z + 1.0, 3, 0.05)
  steel.box(0.04, 1.2, 0.04, -8.0, PA.dockY + 0.6, Z + 1.9, 0.18, 0, 0) // hand-truck upright
  steel.box(0.4, 0.03, 0.3, -8.0, PA.dockY + 0.05, Z + 2.0)
  rubber.cyl(0.09, 0.09, 0.05, -8.15, PA.dockY + 0.09, Z + 1.95, 10, 0, 0, Math.PI / 2)

  // ── utilities on the façades ───────────────────────────────────────────────────────────────────────────────────────────────
  for (const x of [-11.75, -4.15]) { // drainpipes with brackets
    steel.cyl(0.055, 0.055, PA.RL.h - 0.2, x, PA.RL.h / 2 - 0.1 + PA.dockY * 0.0, Z + 0.1, 8)
    for (let y = 2.2; y < PA.RL.h - 1.0; y += 2.4) steel.box(0.16, 0.05, 0.12, x, y, Z + 0.07)
  }
  steel.box(7.9, 0.12, 0.26, -7.9, 5.25, Z + 0.1) // cable tray under the first window row
  for (let k = 0; k < 3; k++) steel.cyl(0.018, 0.018, 7.8, -7.9, 5.28 + k * 0.01, Z + 0.06 + k * 0.045, 5, 0, 0, Math.PI / 2)
  for (const x of [-10.4, -5.6]) { steel.box(0.5, 0.3, 0.12, x, 5.0, Z + 0.07); steel.cyl(0.02, 0.02, 0.8, x, 4.55, Z + 0.07, 5) } // junction boxes + drop
  for (const x of [6.2, 13.2]) steel.cyl(0.055, 0.055, PA.RR.h - 0.2, x, PA.RR.h / 2 - 0.1, Z + 0.1, 8)
  steel.box(0.9, 1.25, 0.32, 12.6, 0.78, Z + 0.17) // electrical cabinet
  steel.box(0.94, 0.06, 0.36, 12.6, 1.43, Z + 0.17)
  cap.box(0.05, 0.9, 0.02, 12.6, 0.8, Z + 0.34) // its door seam
  // fire escape on the RR face: landings at each floor, steep stairs alternating, rails, ladder to the ground
  const fx0 = 4.45, fx1 = 7.35, floors = [3.6, 6.95, 10.3, 13.65, 17.0]
  floors.forEach((y, i) => {
    steel.box(fx1 - fx0, 0.05, 1.15, (fx0 + fx1) / 2, y, Z + 0.58)
    steel.box(fx1 - fx0, 0.9, 0.035, (fx0 + fx1) / 2, y + 0.46, Z + 1.14)
    for (const sx of [fx0, fx1]) steel.box(0.035, 0.9, 1.1, sx, y + 0.46, Z + 0.58)
    for (let q = 0; q < 6; q++) steel.cyl(0.012, 0.012, 0.88, fx0 + 0.25 + q * (fx1 - fx0 - 0.5) / 5, y + 0.46, Z + 1.13, 4)
    if (i < floors.length - 1) {
      const dir = i % 2 === 0 ? 1 : -1
      const run = 2.1, rise = floors[i + 1] - y, len = Math.hypot(run, rise), ang = Math.atan2(rise, run) * dir
      steel.box(len, 0.045, 0.8, (fx0 + fx1) / 2, y + rise / 2, Z + 0.45, 0, 0, ang)
      for (const zz of [Z + 0.05, Z + 0.85]) steel.box(len, 0.1, 0.03, (fx0 + fx1) / 2, y + rise / 2, zz, 0, 0, ang)
    }
  })
  for (let y = 0.4; y < 3.6; y += 0.3) steel.box(0.5, 0.025, 0.025, 4.85, y, Z + 0.4)
  steel.box(0.03, 3.6, 0.03, 4.62, 1.8, Z + 0.4); steel.box(0.03, 3.6, 0.03, 5.1, 1.8, Z + 0.4)
  // wall lamp on the RR ground floor + one at the passage mouth
  steel.box(0.12, 0.26, 0.3, 4.0, 3.0, Z + 0.18); glow.box(0.08, 0.1, 0.2, 4.0, 2.92, Z + 0.3)

  // ── roofs: silhouettes (seen against the sky from the whole plaza) ─────────────────────────────────────────────────────
  const rf = (x: number, y: number, z: number, w: number, h: number, d: number, b: GeoBuilder = roof) => b.box(w, h, d, x, y + h / 2, z)
  // RL: two ventilation stacks, an extractor unit with a duct, a tank on a steel stand, an antenna
  for (const x of [-11.2, -6.0]) { roof.cyl(0.3, 0.3, 1.9, x, PA.RL.h + 1.0, Z - 3.2, 10); roof.cyl(0.0, 0.5, 0.3, x, PA.RL.h + 2.05, Z - 3.2, 10) }
  rf(-8.6, PA.RL.h, Z - 6.5, 1.6, 1.2, 1.4); roof.cyl(0.2, 0.2, 3.0, -9.9, PA.RL.h + 1.1, Z - 6.5, 8, 0, 0, Math.PI / 2)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) steel.cyl(0.05, 0.05, 2.4, -5.0 + dx * 0.95, PA.RL.h + 1.2, Z - 9 + dz * 0.95, 6)
  steel.box(2.3, 0.12, 2.3, -5.0, PA.RL.h + 2.4, Z - 9); wood.cyl(1.3, 1.3, 2.2, -5.0, PA.RL.h + 2.4 + 1.16, Z - 9, 16); roof.cyl(0.0, 1.46, 0.8, -5.0, PA.RL.h + 2.4 + 2.2 + 0.4, Z - 9, 16)
  steel.cyl(0.025, 0.025, 6.5, -12.0, PA.RL.h + 3.2, Z - 2.5, 5); steel.box(1.3, 0.04, 0.04, -12.0, PA.RL.h + 5.2, Z - 2.5)
  // RR (on the set-back roof): bulkhead, two stacks, a mast
  const ty = PA.RR.topH
  rf(10.6, ty, PA.RR.topZ - 4.5, 3.0, 2.5, 3.2, brickRR); stone.box(3.3, 0.14, 3.5, 10.6, ty + 2.57, PA.RR.topZ - 4.5)
  for (const x of [5.2, 12.4]) { rf(x, ty, PA.RR.topZ - 3.0, 0.9, 2.3, 0.9, brickRR); stone.box(1.1, 0.12, 1.1, x, ty + 2.36, PA.RR.topZ - 3.0) }
  steel.cyl(0.03, 0.03, 8.0, 7.2, ty + 4.0, PA.RR.topZ - 2.5, 5); steel.box(1.1, 0.04, 0.04, 7.2, ty + 6.4, PA.RR.topZ - 2.5)
  // the main-block roof beside the set-back: a stair bulkhead + vents
  rf(11.8, PA.RR.h, Z - 1.4, 1.4, 1.3, 1.1, roof)

  // ── the footbridge across the passage ─────────────────────────────────────────────────────────────────────────────────────
  const B = PA.bridge, bw = PA.passHW * 2 + 0.6
  roof.box(bw, B.h, B.w, 0, B.y, B.z) // enclosed corridor
  steel.box(bw, 0.16, B.w + 0.2, 0, B.y - B.h / 2 - 0.1, B.z) // steel floor beam
  steel.box(bw, 0.12, B.w + 0.2, 0, B.y + B.h / 2 + 0.07, B.z)
  for (const x of [-2.4, -0.8, 0.8, 2.4]) steel.box(0.12, 0.9, B.w, x, B.y - B.h / 2 - 0.5, B.z, 0, 0, x > 0 ? 0.6 : -0.6) // braces
  for (const sz of [-1, 1]) { glow.box(bw - 1.0, 0.7, 0.03, 0, B.y + 0.1, B.z + sz * (B.w / 2 + 0.005)); steel.box(bw - 0.9, 0.06, 0.05, 0, B.y + 0.48, B.z + sz * (B.w / 2 + 0.02)); steel.box(bw - 0.9, 0.06, 0.05, 0, B.y - 0.26, B.z + sz * (B.w / 2 + 0.02)) }
  for (let x = -2.9; x <= 2.9; x += 0.97) for (const sz of [-1, 1]) steel.box(0.05, 0.7, 0.05, x, B.y + 0.1, B.z + sz * (B.w / 2 + 0.02))
  // pipes along the passage walls + a hanging lamp on a cable
  for (const side of [-1, 1] as const) {
    steel.cyl(0.07, 0.07, PA.zFace - PA.endZ - 4, side * (PA.passHW - 0.1), 3.2, (PA.zFace + PA.endZ) / 2 + 1, 8, Math.PI / 2, 0, 0)
    steel.cyl(0.03, 0.03, PA.zFace - PA.endZ - 4, side * (PA.passHW - 0.08), 3.55, (PA.zFace + PA.endZ) / 2 + 1, 5, Math.PI / 2, 0, 0)
  }
  steel.box(PA.passHW * 2, 0.02, 0.02, 0, 9.4, -139) // cable between the walls
  steel.cyl(0.015, 0.015, 1.4, 0, 8.7, -139, 4); steel.cyl(0.04, 0.3, 0.3, 0, 7.95, -139, 12); glow.cyl(0.08, 0.08, 0.14, 0, 7.82, -139, 8)
  // end façade: a fire escape + a lamp over a service door
  steel.box(0.12, 0.26, 0.3, -2.9, 2.9, PA.endZ + 0.18); glow.box(0.08, 0.1, 0.2, -2.9, 2.82, PA.endZ + 0.3)

  // ── plaza ground: seams, repairs, a trench drain, a manhole, bollards ─────────────────────────────────────────────────
  const seam = new GeoBuilder(), patch = new GeoBuilder()
  const gy = (x: number, z: number) => roadY(x, z, 0)
  const ribbon = (b: GeoBuilder, ax: number, az: number, bx: number, bz: number, w: number, lift = 0.004) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.2))
    for (let i = 0; i < n; i++) {
      const x0 = ax + ((bx - ax) * i) / n, z0 = az + ((bz - az) * i) / n, x1 = ax + ((bx - ax) * (i + 1)) / n, z1 = az + ((bz - az) * (i + 1)) / n
      const g = new THREE.PlaneGeometry(1, 1)
      g.rotateX(-Math.PI / 2)
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.02, ang = Math.atan2(x1 - x0, z1 - z0)
      g.scale(w, 1, len)
      b.add(g, (x0 + x1) / 2, (gy(x0, z0) + gy(x1, z1)) / 2 + lift, (z0 + z1) / 2, 0, ang, 0)
    }
  }
  for (const x of [-8, -4, 0, 4, 8]) ribbon(seam, x, -78, x, -117, 0.03) // longitudinal joints every 4 m
  for (let z = -80; z > -117; z -= 4.6) ribbon(seam, -11.8, z, 11.8, z, 0.03) // transverse joints
  // saw-cut cracks that wander
  for (let i = 0; i < 9; i++) {
    let x = (r() - 0.5) * 20, z = -80 - r() * 34
    const dir = r() * Math.PI
    for (let k = 0; k < 4; k++) {
      const nx = x + Math.sin(dir + (r() - 0.5) * 0.9) * (0.7 + r() * 0.9), nz = z + Math.cos(dir + (r() - 0.5) * 0.9) * (0.7 + r() * 0.9)
      ribbon(seam, x, z, nx, nz, 0.012 + r() * 0.01, 0.005); x = nx; z = nz
    }
  }
  // asphalt/mortar repair patches (slightly different tone & roughness; sharp straight edges)
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * 19, z = -80 - r() * 34, w = 0.9 + r() * 1.8, d = 0.7 + r() * 1.5, a = (r() - 0.5) * 0.25
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2)
    patch.add(g, x, gy(x, z) + 0.004, z, 0, a, 0)
  }
  // trench drain across the plaza (steel grate in a frame) + a manhole
  const tz = -112
  iron.box(19.6, 0.03, 0.38, 0, gy(0, tz) + 0.006, tz)
  for (let x = -9.6; x <= 9.6; x += 0.18) iron.box(0.06, 0.036, 0.3, x, gy(x, tz) + 0.008, tz)
  const mh = [-4.2, -88.0] as const
  iron.cyl(0.52, 0.52, 0.03, mh[0], gy(mh[0], mh[1]) + 0.006, mh[1], 20); iron.cyl(0.44, 0.44, 0.04, mh[0], gy(mh[0], mh[1]) + 0.008, mh[1], 20)
  // bollards at the passage mouth: steel tube, yellow band, concrete collar
  for (const x of [-2.7, -0.9, 0.9, 2.7]) {
    const z = -115.9
    iron.cyl(0.095, 0.095, 1.0, x, 0.5, z, 10); iron.cyl(0.13, 0.15, 0.06, x, 0.03, z, 10)
    cap.cyl(0.098, 0.098, 0.16, x, 0.82, z, 10)
  }


  // ── the plaza's side walls: dressing that makes a long brick plane a BUILT wall (kept ≤ 0.35 m proud: the rig camera passes 1.4 m from the west wall) ──
  const lamps: PlazaParts['lamps'] = [
    { p: [-9.0, 4.2, -117.4], s: 3.4, o: 1 }, { p: [-6.0, 4.2, -117.4], s: 3.4, o: 1 }, { p: [4.0, 2.9, -117.55], s: 2.6, o: 0.8 },
    { p: [-2.9, 2.8, -149.6], s: 2.6, o: 0.8 }, { p: [0, 7.8, -139], s: 4.2, o: 1.1 }, { p: [0, 8.5, -126.9], s: 6.5, o: 0.55 },
  ]
  const rs = rng(7733)
  const WX = 12
  for (const side of [-1, 1] as const) {
    const x = side * WX, n = -side // n: toward the plaza
    const zA = -77, zB = -117.5, zc = (zA + zB) / 2, len = zA - zB
    // plinth: a cast-stone base course with a chamfered top, so the brick has something to stand on
    stone.box(0.26, 1.0, len, x + n * 0.13, 0.5, zc)
    stone.box(0.3, 0.06, len, x + n * 0.15, 1.03, zc)
    // drainpipes with brackets and a ground shoe
    for (const z of side === -1 ? [-81.5, -95.5, -111.0] : [-84.0, -99.0, -113.5]) {
      steel.cyl(0.055, 0.055, 19.6, x + n * 0.1, 9.9, z, 8)
      for (let y = 2.0; y < 19; y += 2.4) steel.box(0.16, 0.05, 0.12, x + n * 0.07, y, z)
      steel.box(0.16, 0.22, 0.2, x + n * 0.16, 0.3, z + 0.05)
    }
    // a cable tray with its bundle and clips, running the length of the wall under the first window row
    steel.box(0.07, 0.1, len - 1, x + n * 0.05, 4.1, zc)
    for (let k = 0; k < 3; k++) steel.cyl(0.016, 0.016, len - 1.2, x + n * 0.09, 4.12 + k * 0.012, zc - 0.03 + k * 0.03, 5, Math.PI / 2, 0, 0)
    for (let z = zA - 1.5; z > zB + 1; z -= 2.2) steel.box(0.1, 0.07, 0.07, x + n * 0.07, 4.1, z)
    // electrical meter cabinets with their riser pipes, wall lamps, AC condensers on brackets, louvred vents
    const mz = side === -1 ? [-88.0, -108.5] : [-90.5, -112.0]
    for (const z of mz) {
      steel.box(0.5, 0.7, 0.18, x + n * 0.09 + 0.0, 1.55, z); steel.box(0.54, 0.05, 0.22, x + n * 0.09, 1.93, z)
      cap.box(0.18, 0.28, 0.02, x + n * 0.19, 1.6, z) // its glazed window
      steel.cyl(0.018, 0.018, 1.0, x + n * 0.07, 2.5, z, 5)
    }
    for (const z of side === -1 ? [-84.0, -92.0, -114.0] : [-87.0, -96.5, -115.0]) {
      steel.box(0.12, 0.26, 0.3, x + n * 0.07, 3.4, z); glow.box(0.08, 0.1, 0.2, x + n * 0.15, 3.32, z)
      lamps.push({ p: [x + n * 0.2, 3.3, z], s: 2.6, o: 0.8 })
    }
    for (const z of side === -1 ? [-90.0, -107.5] : [-93.0, -105.0]) {
      steel.box(0.4, 0.06, 0.9, x + n * 0.18, 6.2, z) // bracket tray
      steel.box(0.34, 0.62, 0.84, x + n * 0.23, 6.55, z) // condenser casing
      cap.box(0.02, 0.5, 0.6, x + n * 0.42, 6.55, z) // fan grille
      steel.cyl(0.012, 0.012, 2.4, x + n * 0.1, 5.0, z + 0.5, 4) // refrigerant line
    }
    for (const z of side === -1 ? [-86.0, -98.0, -112.5] : [-82.5, -95.0, -109.0]) {
      rubber.box(0.1, 0.5, 0.9, x + n * 0.05, 2.5, z)
      for (let k = 0; k < 6; k++) steel.box(0.04, 0.025, 0.86, x + n * 0.09, 2.3 + k * 0.075, z, 0.35, 0, 0)
    }
    // a surface-mounted service door in a cast surround (west: toward the rear; east: near the entrance) — clear of the cameras
    const dz = side === -1 ? -80.2 : -116.2
    stone.box(0.3, 0.26, 1.55, x + n * 0.15, 2.5, dz); stone.box(0.3, 2.4, 0.18, x + n * 0.15, 1.2, dz + 0.68); stone.box(0.3, 2.4, 0.18, x + n * 0.15, 1.2, dz - 0.68)
    stone.box(0.45, 0.07, 1.5, x + n * 0.22, 0.1, dz) // threshold step
    doors.push({ kind: 'door', variant: side === -1 ? 0 : 2, x: x + n * 0.1, y: 1.18, z: dz, w: 1.15, h: 2.35, ry: side === -1 ? Math.PI / 2 : -Math.PI / 2 })
  }
  void rs

  const out: PlazaParts['parts'] = {}
  const put = (k: PlazaKey, b: GeoBuilder) => { if (!b.empty) out[k] = withWhite(b.build()) }
  put('stone', stone); put('steel', steel); put('roof', roof); put('wood', wood); put('cap', cap); put('rubber', rubber); put('crate', crate); put('glow', glow)
  put('seam', seam); put('patch', patch); put('iron', iron)
  const merge = (list: THREE.BufferGeometry[]) => { for (const g of list) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)) } }
  void merge
  // brick relief joins the façade geometry of its block (same material → one merged mesh per block)
  const brickOf = { rl: brickRL, rr: brickRR, end: brickEnd }
  for (const k of ['rl', 'rr', 'end'] as const) if (!brickOf[k].empty) walls.push({ key: k, geo: withWhite(brickOf[k].build()) })
  walls.forEach((w) => withWhite(w.geo))
  return { walls, parts: out, doors, lamps }
}
