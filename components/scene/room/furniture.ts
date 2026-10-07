import * as THREE from 'three'
import { L } from '@/lib/room'
import { Batch } from './batch'

/**
 * Everything that stands in the room, built with believable construction (thickness, frames, legs, hardware) and merged per material.
 * Room-local frame: x right, y up, −z into the room. Every object rests on the floor, on another object, or is fixed to a wall / the ceiling.
 */
export interface Ctx {
  /** painted / rubber / paper — vertex colour only */
  matte: Batch
  /** satin black plastic, powder-coated steel, vinyl */
  satin: Batch
  /** bare / brushed / chrome metal (reflects the room probe) */
  metal: Batch
  /** textured wood (grain along u) */
  wood: Batch
  /** textured woven cloth */
  fabric: Batch
  /** acoustic foam (grain texture) */
  foam: Batch
  /** emissives (HDR vertex colours) */
  glow: Batch
  level: number
}

/** placement constants shared with the scene (screens, prints, lights, hit areas) */
export const PLACE = {
  deskTop: 0.77,
  hero: { x: 0.5, y: 1.22, z: -8.275, w: 0.36, h: 0.64 },
  daw: { x: -0.52, y: 1.14, z: -8.292, w: 0.62, h: 0.349 },
  crt: { x: -2.36, y: 0.86, z: -8.1, ry: 0.5, glass: [0.34, 0.27] as [number, number] },
  phone: { x: 1.18, y: 0.842, z: -7.985 },
  lamp: { x: -0.9, y: 1.24, z: -8.2 },
  spkL: { x: -1.5, z: -8.2, ry: 0.42 },
  spkR: { x: 1.85, z: -8.15, ry: -0.42 },
  keys: { x: 0.0, z: -7.92 },
  portrait: { x: 3.2, y: 1.17, z: -5.45 },
  live: { x: -3.2, y: 1.25, z: -3.2 },
  alterco: { x: -3.2, y: 1.48, z: -6.4, s: 0.62 },
}

const BLACK = '#131416', SATIN = '#1d1e21', GRAPH = '#2b2d31', STEEL = '#8f949b', DSTEEL = '#3b3e44'

/* ───────────────────────── the desk ───────────────────────── */
export function desk(c: Ctx) {
  const T = PLACE.deskTop, th = 0.045
  const x0 = -1.15, x1 = 1.55, zb = -8.56, zf = -7.7, cx = (x0 + x1) / 2, cz = (zb + zf) / 2
  // the top: a solid slab, its front edge banded
  c.wood.box(x1 - x0, th, zf - zb, cx, T - th / 2, cz, '#8b6a49', { r: 0.008, tile: 1.6, ao: 0 })
  c.wood.box(x1 - x0 - 0.02, 0.046, 0.006, cx, T - th / 2, zf + 0.0005, '#a07d58', { tile: 0.6, ao: 0, swap: false })
  // left: a steel trestle (two uprights, a top rail and a foot rail, welded)
  const trestle = (x: number) => {
    for (const z of [zb + 0.07, zf - 0.07]) c.satin.ab(x - 0.021, x + 0.021, 0, T - th, z - 0.021, z + 0.021, BLACK, { r: 0.004, ao: 0.25 })
    c.satin.ab(x - 0.021, x + 0.021, T - th - 0.04, T - th, zb + 0.05, zf - 0.05, BLACK, { r: 0.004, ao: 0 })
    c.satin.ab(x - 0.021, x + 0.021, 0.0, 0.04, zb + 0.05, zf - 0.05, BLACK, { r: 0.004, ao: 0.3 })
    for (const z of [zb + 0.07, zf - 0.07]) c.matte.cyl(0.026, 0.026, 0.008, x, 0.004, z, '#0a0a0b', { n: 10, ao: 0.2 }) // rubber feet
  }
  trestle(-1.06)
  // right: a three-drawer pedestal (painted steel carcass, flush drawer fronts, bar handles)
  const px0 = 0.98, px1 = 1.52, pz0 = zb + 0.02, pz1 = zf - 0.03
  c.satin.ab(px0, px1, 0.035, T - th, pz0, pz1, '#202226', { r: 0.004, ao: 0.4, seg: [1, 3, 1] })
  c.satin.ab(px0 + 0.02, px1 - 0.02, 0, 0.035, pz0 + 0.03, pz1 - 0.05, '#0c0c0d', { ao: 0.5 }) // recessed plinth
  const dh = (T - th - 0.05) / 3
  for (let i = 0; i < 3; i++) {
    const y0 = 0.045 + i * dh
    c.satin.ab(px0 + 0.012, px1 - 0.012, y0 + 0.004, y0 + dh - 0.004, pz1 - 0.008, pz1 + 0.012, '#26282c', { r: 0.003, ao: 0.35 })
    c.metal.ab(px0 + 0.19, px1 - 0.19, y0 + dh - 0.05, y0 + dh - 0.04, pz1 + 0.012, pz1 + 0.03, '#aeb2b8', { r: 0.003, ao: 0.3 })
    for (const sx of [-0.1, 0.1]) c.metal.box(0.008, 0.012, 0.018, (px0 + px1) / 2 + sx, y0 + dh - 0.045, pz1 + 0.021, '#aeb2b8', { ao: 0 })
  }
  // modesty / cable panel and the tray under the top (power strip, cable bundle)
  c.satin.ab(x0 + 0.1, px0, 0.44, T - th - 0.05, zb + 0.07, zb + 0.082, '#17181a', { ao: 0.3 })
  c.satin.ab(-0.95, 0.9, T - th - 0.045, T - th - 0.043, zb + 0.09, zb + 0.34, '#0e0f10', { ao: 0 })
  c.satin.ab(-0.95, 0.9, T - th - 0.045, T - th - 0.02, zb + 0.34, zb + 0.346, '#0e0f10', { ao: 0 })
  c.satin.ab(-0.2, 0.2, T - th - 0.075, T - th - 0.046, zb + 0.12, zb + 0.19, '#1a1b1d', { r: 0.004, ao: 0 }) // power strip
  c.glow.box(0.008, 0.008, 0.002, 0.16, T - th - 0.061, zb + 0.191, '#ff6a40', { i: 1.4, ao: 0 })
  // the red under-desk glow: an aluminium channel screwed to the underside, the LED recessed in it
  c.metal.ab(x0 + 0.04, x1 - 0.04, T - th - 0.012, T - th, zf - 0.075, zf - 0.052, '#6b6f76', { ao: 0 })
  c.glow.ab(x0 + 0.05, x1 - 0.05, T - th - 0.016, T - th - 0.012, zf - 0.069, zf - 0.058, '#cf6550', { i: 0.8, ao: 0 })
}

/* ───────────────────────── a display: housing, bezel, stand ───────────────────────── */
export function display(c: Ctx, cx: number, cy: number, zs: number, w: number, h: number, stand: { neck: number; foot: number }) {
  const bz = 0.008 // bezel width
  // bezel: four strips standing 3 mm proud of the panel (the screen is recessed)
  const front = zs + 0.003
  c.satin.ab(cx - w / 2 - bz, cx + w / 2 + bz, cy + h / 2, cy + h / 2 + bz, zs - 0.018, front, '#0d0d0f', { r: 0.002, ao: 0 })
  c.satin.ab(cx - w / 2 - bz, cx + w / 2 + bz, cy - h / 2 - bz, cy - h / 2, zs - 0.018, front, '#0d0d0f', { r: 0.002, ao: 0 })
  c.satin.ab(cx - w / 2 - bz, cx - w / 2, cy - h / 2, cy + h / 2, zs - 0.018, front, '#0d0d0f', { r: 0.002, ao: 0 })
  c.satin.ab(cx + w / 2, cx + w / 2 + bz, cy - h / 2, cy + h / 2, zs - 0.018, front, '#0d0d0f', { r: 0.002, ao: 0 })
  // panel back + the thicker electronics bulge
  c.satin.ab(cx - w / 2 - bz, cx + w / 2 + bz, cy - h / 2 - bz, cy + h / 2 + bz, zs - 0.026, zs - 0.012, '#15161a', { r: 0.005, ao: 0 })
  c.satin.box(w * 0.62, h * 0.55, 0.026, cx, cy, zs - 0.038, '#1a1b1f', { r: 0.008, ao: 0 })
  // stand: foot plate on the desk, neck, hinge block behind the panel
  const T = PLACE.deskTop
  const fz = zs - 0.06
  c.metal.box(stand.foot, 0.014, stand.foot * 0.72, cx, T + 0.007, fz + 0.03, '#2a2c31', { r: 0.005, ao: 0 })
  c.metal.ab(cx - 0.028, cx + 0.028, T + 0.012, cy - h * 0.2, fz - 0.012, fz + 0.012, '#2a2c31', { r: 0.004, ao: 0 })
  c.metal.box(0.09, 0.09, 0.016, cx, cy - h * 0.12, zs - 0.054, '#2a2c31', { r: 0.004, ao: 0 })
  c.glow.box(0.006, 0.003, 0.002, cx + w * 0.38, cy - h / 2 - bz / 2, front + 0.0002, '#7aff9a', { i: 0.9, ao: 0 }) // power LED in the bezel
}

/* ───────────────────────── studio monitor on a stand ───────────────────────── */
export function speaker(c: Ctx, x: number, z: number, ry: number) {
  c.matte.group(x, 0, z, ry, () => {
    // stand: weighted base, column, top plate
    c.metal.box(0.34, 0.012, 0.3, 0, 0.006, 0, '#23252a', { r: 0.004, ao: 0.2 })
    c.metal.cyl(0.022, 0.022, 0.82, 0, 0.42, 0, '#2d3036', { n: 10, ao: 0.2 })
    c.metal.box(0.28, 0.01, 0.26, 0, 0.835, 0, '#23252a', { r: 0.003, ao: 0 })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.matte.cyl(0.012, 0.012, 0.006, sx * 0.12, 0.841, sz * 0.1, '#0a0a0b', { n: 8, ao: 0 })
    // cabinet (rounded, satin) + a slightly proud baffle
    c.satin.box(0.26, 0.38, 0.3, 0, 1.03, 0, SATIN, { r: 0.016, ao: 0 })
    c.satin.box(0.246, 0.366, 0.01, 0, 1.03, 0.153, '#17181b', { r: 0.008, ao: 0 })
    // 8" woofer: surround, cone, dust cap; tweeter with waveguide; bass port
    const fz = 0.16
    c.matte.cyl(0.098, 0.098, 0.006, 0, 0.96, fz, '#0b0b0c', { rx: Math.PI / 2, n: 24, ao: 0 })
    c.satin.cyl(0.076, 0.062, 0.012, 0, 0.96, fz + 0.003, '#34363b', { rx: Math.PI / 2, n: 24, ao: 0 })
    c.satin.cyl(0.026, 0.026, 0.014, 0, 0.96, fz + 0.009, '#16171a', { rx: Math.PI / 2, n: 16, ao: 0 })
    c.matte.cyl(0.034, 0.034, 0.006, 0, 1.16, fz, '#0b0b0c', { rx: Math.PI / 2, n: 18, ao: 0 })
    c.metal.cyl(0.02, 0.02, 0.008, 0, 1.16, fz + 0.004, '#a9acb2', { rx: Math.PI / 2, n: 16, ao: 0 })
    c.matte.ab(-0.09, 0.09, 0.855, 0.875, fz - 0.002, fz + 0.002, '#050506', { ao: 0 })
    c.glow.box(0.012, 0.012, 0.002, 0.1, 0.88, fz + 0.004, '#4cb0ff', { i: 1.5, ao: 0 })
  })
}

/* ───────────────────────── the keyboard (controller + keybed) ───────────────────────── */
export function keyboard(c: Ctx) {
  const { x, z } = PLACE.keys
  const T = PLACE.deskTop
  c.matte.group(x, T, z, 0, () => {
    c.satin.box(1.0, 0.04, 0.3, 0, 0.02, 0, '#111214', { r: 0.008, ao: 0 })
    for (const sx of [-0.44, 0.44]) c.matte.box(0.06, 0.004, 0.03, sx, 0.002, 0.12, '#050505', { ao: 0 })
  })
  if (c.level >= 1) {
    // physical keybed: 42 white keys, the black ones raised, across the front half of the body; the controller strip behind it is a textured plane
    const kw = 0.0233, nk = 42, kx0 = -0.49
    for (let i = 0; i < nk; i++) c.matte.box(kw - 0.0016, 0.012, 0.15, x + kx0 + i * kw + kw / 2, T + 0.046, z + 0.075, '#d6d1c4', { r: 0.001, ao: 0, jit: 0.07 })
    for (let i = 0; i < nk - 1; i++) {
      const o = i % 7
      if (o === 2 || o === 6) continue
      c.satin.box(kw * 0.58, 0.012, 0.09, x + kx0 + (i + 1) * kw, T + 0.057, z + 0.037, '#0b0b0d', { r: 0.001, ao: 0 })
    }
  }
}

/* ───────────────────────── audio interface, lamp, mug, papers, phone, headphones ───────────────────────── */
export function deskObjects(c: Ctx) {
  const T = PLACE.deskTop
  // audio interface: satin box, three metal knobs, LEDs
  c.matte.group(-0.98, T, -8.05, -0.18, () => {
    c.satin.box(0.24, 0.07, 0.2, 0, 0.035, 0, '#1b1c20', { r: 0.006, ao: 0 })
    c.satin.ab(-0.115, 0.115, 0.058, 0.0605, 0.098, 0.1, '#3b3e45', { ao: 0 })
    for (let i = 0; i < 3; i++) c.metal.cyl(0.014, 0.014, 0.018, -0.07 + i * 0.07, 0.044, 0.11, '#9a9ea6', { rx: Math.PI / 2, n: 12, ao: 0 })
    for (let i = 0; i < 4; i++) c.glow.box(0.012, 0.012, 0.003, 0.0 + 0.025 * i - 0.01, 0.062, 0.101, i === 2 ? '#ff3a2a' : '#44ff88', { i: 1.7, ao: 0 })
    c.matte.cyl(0.006, 0.006, 0.02, 0.1, 0.035, 0.1, '#0a0a0b', { rx: Math.PI / 2, n: 8, ao: 0 })
  })
  // desk lamp: weighted base, two arms with joints, conical shade with the bulb
  const lb = { x: -1.02, z: -8.4 }
  c.metal.cyl(0.07, 0.075, 0.02, lb.x, T + 0.01, lb.z, '#17181a', { n: 18, ao: 0 })
  c.metal.cyl(0.018, 0.018, 0.03, lb.x, T + 0.035, lb.z, '#17181a', { n: 10, ao: 0 })
  const elbow: [number, number, number] = [-1.0, 1.14, -8.37], head: [number, number, number] = [-0.93, 1.27, -8.24]
  c.metal.rod([lb.x, T + 0.04, lb.z], elbow, 0.0085, '#1d1e21', { n: 8, ao: 0 })
  c.metal.rod(elbow, head, 0.0085, '#1d1e21', { n: 8, ao: 0 })
  for (const p of [[lb.x, T + 0.04, lb.z], elbow, head] as [number, number, number][]) c.metal.cyl(0.013, 0.013, 0.02, p[0], p[1], p[2], '#34363b', { rz: Math.PI / 2, n: 10, ao: 0 })
  // shade: an open cone tilted down toward the desk, bulb inside
  const sh = new THREE.ConeGeometry(0.09, 0.13, 18, 1, true)
  sh.translate(0, -0.065, 0)
  c.satin.geo(sh, '#26282c', head[0], head[1], head[2], { rx: -0.45, rz: 0.4, ao: 0 })
  c.glow.geo(new THREE.SphereGeometry(0.026, 10, 8), '#ffd19a', head[0] + 0.02, head[1] - 0.04, head[2] + 0.025, { i: 1.45, ao: 0 })
  // mug (lathe, handle) and a pencil
  c.matte.group(-0.3, T, -7.98, 0.4, () => {
    c.satin.lathe([[0, 0], [0.036, 0], [0.038, 0.004], [0.04, 0.09], [0.037, 0.092], [0.035, 0.086], [0.0, 0.008]], 0, 0, 0, '#d8d2c4', { n: 16, ao: 0 })
    c.satin.tube([new THREE.Vector3(0.04, 0.075, 0), new THREE.Vector3(0.062, 0.07, 0), new THREE.Vector3(0.066, 0.045, 0), new THREE.Vector3(0.04, 0.025, 0)], 0.005, '#d8d2c4', { ao: 0, steps: 10 })
  })
  // a few sheets, one half over the other
  c.matte.box(0.21, 0.002, 0.297, 0.98, T + 0.001, -8.1, '#e5dfd0', { ry: 0.38, ao: 0 })
  c.matte.box(0.21, 0.002, 0.297, 1.0, T + 0.003, -8.08, '#ece6d8', { ry: 0.31, ao: 0 })
  // headphones on a stand (not in mid-air)
  c.metal.cyl(0.07, 0.075, 0.012, 1.18, T + 0.006, -8.36, '#1b1c1f', { n: 16, ao: 0 })
  c.metal.cyl(0.011, 0.011, 0.34, 1.18, T + 0.18, -8.36, '#26282c', { n: 8, ao: 0 })
  c.metal.cyl(0.03, 0.03, 0.012, 1.18, T + 0.35, -8.36, '#26282c', { n: 12, ao: 0 })
  const band = new THREE.TorusGeometry(0.085, 0.009, 6, 20, Math.PI)
  c.satin.geo(band, '#111214', 1.18, T + 0.368, -8.36, { rz: 0, ry: 0.3, ao: 0 })
  for (const sx of [-1, 1]) c.satin.cyl(0.05, 0.05, 0.036, 1.18 + sx * 0.085 * Math.cos(0.3), T + 0.31, -8.36 - sx * 0.085 * Math.sin(0.3), '#17181b', { rz: Math.PI / 2, ry: 0.3, n: 16, ao: 0 })
  // the phone: a slim body leaning on a wedge stand (the lit face is a screen mesh in the scene)
  const ph = PLACE.phone
  c.metal.box(0.08, 0.012, 0.09, ph.x, T + 0.006, ph.z + 0.01, '#2a2b30', { ry: 0.3, r: 0.003, ao: 0 })
  c.satin.box(0.072, 0.15, 0.008, ph.x, ph.y - 0.003, ph.z - 0.002, '#0b0b0d', { rx: -0.3, ry: 0.3, r: 0.004, ao: 0 })
}

/* ───────────────────────── chair ───────────────────────── */
export function chair(c: Ctx) {
  c.matte.group(-1.15, 0, -7.05, 1.9, () => {
    // five-star base on casters, gas lift, tilt mechanism
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3
      c.satin.bar([0, 0.075, 0], [Math.cos(a) * 0.29, 0.06, Math.sin(a) * 0.29], 0.04, 0.022, '#17181b', { r: 0.004, ao: 0 })
      const cx = Math.cos(a) * 0.3, cz = Math.sin(a) * 0.3
      c.matte.cyl(0.022, 0.022, 0.034, cx, 0.037, cz, '#0b0b0c', { rz: Math.PI / 2, ry: -a, n: 10, ao: 0.2 })
      c.metal.cyl(0.008, 0.008, 0.04, cx, 0.062, cz, '#2a2c31', { n: 6, ao: 0 })
    }
    c.metal.cyl(0.035, 0.03, 0.05, 0, 0.1, 0, '#1d1e21', { n: 12, ao: 0 })
    c.metal.cyl(0.024, 0.024, 0.3, 0, 0.28, 0, '#34363b', { n: 12, ao: 0 })
    c.satin.box(0.2, 0.04, 0.22, 0, 0.455, 0, '#17181b', { r: 0.01, ao: 0 })
    // seat (a cushion: soft, rolled edges) and back
    c.fabric.box(0.5, 0.075, 0.5, 0, 0.5, 0.0, '#5a4d52', { r: 0.03, rs: 2, ao: 0, jit: 0.1 })
    c.satin.bar([0, 0.47, -0.2], [0, 0.66, -0.26], 0.035, 0.02, '#17181b', { r: 0.004, ao: 0 })
    c.fabric.box(0.46, 0.46, 0.065, 0, 0.88, -0.27, '#5a4d52', { r: 0.03, rs: 2, rx: 0.1, ao: 0, jit: 0.1 })
    // armrests
    for (const sx of [-1, 1]) {
      c.satin.bar([sx * 0.255, 0.54, -0.12], [sx * 0.255, 0.68, -0.12], 0.02, 0.02, '#17181b', { ao: 0 })
      c.matte.box(0.05, 0.03, 0.26, sx * 0.255, 0.695, -0.05, '#111214', { r: 0.01, ao: 0 })
    }
  })
}

/* ───────────────────────── microphone on a boom stand ───────────────────────── */
export function micStand(c: Ctx) {
  const x = 2.05, z = -7.0
  c.matte.group(x, 0, z, 0.5, () => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5
      c.metal.bar([0, 0.045, 0], [Math.cos(a) * 0.26, 0.022, Math.sin(a) * 0.26], 0.026, 0.016, '#1c1d20', { r: 0.003, ao: 0 })
      c.matte.cyl(0.016, 0.016, 0.014, Math.cos(a) * 0.27, 0.007, Math.sin(a) * 0.27, '#0a0a0b', { n: 8, ao: 0.2 })
    }
    c.metal.cyl(0.026, 0.03, 0.06, 0, 0.06, 0, '#1c1d20', { n: 12, ao: 0 })
    c.metal.cyl(0.012, 0.012, 1.38, 0, 0.75, 0, '#26282c', { n: 8, ao: 0 })
    c.metal.cyl(0.026, 0.026, 0.03, 0, 1.0, 0, '#17181a', { n: 10, ao: 0 })
    c.metal.cyl(0.03, 0.03, 0.05, 0, 1.44, 0, '#17181a', { n: 10, ao: 0 })
    // boom toward the desk, a counterweight behind
    c.metal.rod([0, 1.44, 0], [-0.3, 1.52, -0.12], 0.0085, '#26282c', { n: 8, ao: 0 })
    c.metal.cyl(0.018, 0.018, 0.07, 0.07, 1.42, 0.02, '#17181a', { rz: 1.47, n: 10, ao: 0 })
    // shock mount ring + large-diaphragm mic (hanging upside-down)
    c.metal.cyl(0.05, 0.05, 0.006, -0.3, 1.5, -0.12, '#1b1c1f', { n: 20, ao: 0 })
    c.satin.cyl(0.026, 0.026, 0.17, -0.3, 1.41, -0.12, '#17181b', { n: 14, ao: 0 })
    c.metal.cyl(0.034, 0.034, 0.05, -0.3, 1.315, -0.12, '#8d9096', { n: 16, ao: 0 })
    c.satin.cyl(0.034, 0.034, 0.012, -0.3, 1.29, -0.12, '#1a1b1e', { n: 16, ao: 0 })
  })
}

/* ───────────────────────── flight case + a cabinet with a grille on it ───────────────────────── */
export function cases(c: Ctx) {
  // the road case: ply body, aluminium extrusions on every edge, ball corners, butterfly latches, a recessed handle
  c.matte.group(2.45, 0, -8.3, 0.04, () => {
    const w = 0.7, h = 0.5, d = 0.5
    c.satin.ab(-w / 2, w / 2, 0.04, h, -d / 2, d / 2, '#1d1f22', { r: 0.006, ao: 0.3, seg: [1, 2, 1] })
    // castors-less: rubber feet
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.matte.cyl(0.03, 0.03, 0.04, sx * (w / 2 - 0.05), 0.02, sz * (d / 2 - 0.05), '#0a0a0b', { n: 10, ao: 0.2 })
    const e = 0.014
    for (const sy of [0.04, h]) {
      for (const sz of [-1, 1]) c.metal.ab(-w / 2, w / 2, sy - e / 2, sy + e / 2, sz * d / 2 - 0.016, sz * d / 2 + 0.016, '#a9adb3', { r: 0.002, ao: 0 })
      for (const sx of [-1, 1]) c.metal.ab(sx * w / 2 - 0.016, sx * w / 2 + 0.016, sy - e / 2, sy + e / 2, -d / 2, d / 2, '#a9adb3', { r: 0.002, ao: 0 })
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.metal.ab(sx * w / 2 - 0.016, sx * w / 2 + 0.016, 0.04, h, sz * d / 2 - 0.016, sz * d / 2 + 0.016, '#a9adb3', { r: 0.002, ao: 0 })
    // lid seam + latches (front)
    c.matte.ab(-w / 2 + 0.02, w / 2 - 0.02, 0.3, 0.303, d / 2, d / 2 + 0.001, '#050506', { ao: 0 })
    for (const sx of [-0.2, 0.2]) {
      c.metal.ab(sx - 0.035, sx + 0.035, 0.27, 0.34, d / 2 + 0.002, d / 2 + 0.008, '#b8bcc2', { r: 0.002, ao: 0 })
      c.metal.ab(sx - 0.015, sx + 0.015, 0.29, 0.31, d / 2 + 0.008, d / 2 + 0.016, '#7c8087', { r: 0.002, ao: 0 })
    }
    // side recessed handle
    c.metal.ab(w / 2 + 0.002, w / 2 + 0.01, 0.2, 0.34, -0.09, 0.09, '#a9adb3', { r: 0.002, ao: 0 })
    c.matte.ab(w / 2 + 0.004, w / 2 + 0.012, 0.22, 0.31, -0.07, 0.07, '#060607', { ao: 0 })
    // the powered cabinet on top: grille cloth over a perforated face, corner protectors, a top handle
    const tw = 0.36, th = 0.5, td = 0.3
    c.matte.group(0.0, h, 0.0, 0.18, () => {
      c.satin.ab(-tw / 2, tw / 2, 0, th, -td / 2, td / 2, '#17181b', { r: 0.012, ao: 0 })
      c.fabric.ab(-tw / 2 + 0.018, tw / 2 - 0.018, 0.02, th - 0.02, td / 2 - 0.004, td / 2 + 0.006, '#17181a', { r: 0.003, ao: 0, tile: 0.12 })
      for (const sx of [-1, 1]) for (const sy of [0, th]) c.metal.box(0.03, 0.03, 0.03, sx * (tw / 2 - 0.004), sy, td / 2 - 0.004, '#9ca0a7', { r: 0.008, ao: 0 })
      c.metal.ab(-0.07, 0.07, th, th + 0.012, -0.03, 0.03, '#26282c', { r: 0.004, ao: 0 })
      c.matte.cyl(0.012, 0.012, 0.003, 0.0, th * 0.9, td / 2 + 0.006, '#cfcfd2', { rx: Math.PI / 2, n: 10, ao: 0 }) // tiny badge dot
    })
  })
}

/* ───────────────────────── crates + CRT television ───────────────────────── */
export function crtUnit(c: Ctx) {
  const t = PLACE.crt
  // two wooden crates: slatted sides, corner posts, handle cut-outs
  const crate = (x: number, y: number, z: number, ry: number, w: number, h: number, d: number, col: string) => {
    c.matte.group(x, y, z, ry, () => {
      c.matte.ab(-w / 2 + 0.01, w / 2 - 0.01, 0.01, h - 0.01, -d / 2 + 0.01, d / 2 - 0.01, '#0a0806', { ao: 0 })
      for (let i = 0; i < 3; i++) {
        const sy = (i + 0.5) * (h / 3)
        c.wood.box(w, h / 3 - 0.012, d, 0, sy, 0, col, { r: 0.004, tile: 0.8, ao: 0.1 })
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.wood.box(0.04, h, 0.04, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), '#4a3a28', { tile: 0.4, ao: 0.15 })
      c.matte.ab(-0.08, 0.08, h * 0.45, h * 0.58, d / 2 + 0.0, d / 2 + 0.001, '#0c0a08', { ao: 0 })
    })
  }
  crate(-2.35, 0, -8.15, 0.04, 0.56, 0.32, 0.46, '#8a6a46')
  crate(-2.38, 0.32, -8.12, 0.15, 0.54, 0.3, 0.44, '#7d5f3f')
  // the TV: tapered CRT tube body, front bezel, knobs, vents, a power cord
  c.matte.group(t.x, 0.62, t.z, t.ry, () => {
    const w = 0.5, h = 0.46, d = 0.5
    c.satin.box(w, h, 0.12, 0, h / 2, d / 2 - 0.06, '#26262a', { r: 0.014, rs: 1, ao: 0 })
    // tapered rear (a frustum, square section)
    const rear = new THREE.CylinderGeometry(0.2, 0.31, 0.38, 4, 1, false)
    rear.rotateY(Math.PI / 4)
    rear.rotateX(-Math.PI / 2)
    rear.scale(1.12, 0.92, 1)
    c.satin.geo(rear, '#1d1d21', 0, h / 2, d / 2 - 0.12 - 0.19, { ao: 0 })
    // bezel frame around the glass + control strip
    const gw = PLACE.crt.glass[0], gh = PLACE.crt.glass[1]
    const fz = d / 2 + 0.0
    c.satin.ab(-gw / 2 - 0.045, gw / 2 + 0.045, h * 0.5 + gh / 2 - 0.02, h * 0.5 + gh / 2 + 0.03, fz - 0.025, fz + 0.012, '#2a2a2f', { r: 0.004, ao: 0 })
    c.satin.ab(-gw / 2 - 0.045, gw / 2 + 0.045, h * 0.5 - gh / 2 - 0.03, h * 0.5 - gh / 2 + 0.02, fz - 0.025, fz + 0.012, '#2a2a2f', { r: 0.004, ao: 0 })
    c.satin.ab(-gw / 2 - 0.045, -gw / 2 + 0.0, h * 0.5 - gh / 2, h * 0.5 + gh / 2, fz - 0.025, fz + 0.012, '#2a2a2f', { r: 0.004, ao: 0 })
    c.satin.ab(gw / 2 + 0.0, gw / 2 + 0.045, h * 0.5 - gh / 2, h * 0.5 + gh / 2, fz - 0.025, fz + 0.012, '#2a2a2f', { r: 0.004, ao: 0 })
    c.satin.ab(-gw / 2 - 0.045, gw / 2 + 0.045, 0.02, 0.055, fz - 0.02, fz + 0.01, '#202024', { r: 0.003, ao: 0 })
    for (const sx of [0.05, 0.1]) c.metal.cyl(0.012, 0.012, 0.016, sx + 0.05, 0.037, fz + 0.016, '#8a8d94', { rx: Math.PI / 2, n: 12, ao: 0 })
    for (let i = 0; i < 5; i++) c.matte.ab(-0.2, -0.06, 0.02 + i * 0.006, 0.023 + i * 0.006, fz + 0.0, fz + 0.011, '#08080a', { ao: 0 })
    // feet
    for (const sx of [-1, 1]) c.matte.box(0.05, 0.02, 0.06, sx * 0.2, -0.0, d / 2 - 0.1, '#0c0c0e', { ao: 0 })
  })
}

/* ───────────────────────── lounge: sofa, low table, rug ───────────────────────── */
export function lounge(c: Ctx) {
  const fab = '#7a6250'
  // sofa against the left wall
  const x0 = -3.12, z0 = -7.4, z1 = -5.4
  c.wood.ab(x0 + 0.02, -2.24, 0.1, 0.27, z0 + 0.02, z1 - 0.02, '#3a2c20', { r: 0.01, tile: 0.8, ao: 0.4 })
  for (const sx of [x0 + 0.1, -2.34]) for (const sz of [z0 + 0.1, z1 - 0.1]) c.wood.cyl(0.024, 0.016, 0.1, sx, 0.05, sz, '#2c2017', { n: 8, tile: 0.4, ao: 0.1, swap: true })
  // arms (rounded, soft) and the back
  for (const [a, b] of [[z0, z0 + 0.2], [z1 - 0.2, z1]]) c.fabric.ab(x0, -2.22, 0.1, 0.6, a, b, fab, { r: 0.07, rs: 2, ao: 0.4, jit: 0.1, tile: 0.35 })
  c.fabric.ab(x0, -2.93, 0.2, 0.82, z0 + 0.1, z1 - 0.1, '#725a48', { r: 0.06, rs: 2, ao: 0.35, jit: 0.1, tile: 0.35, seg: [1, 1, 1] })
  // seat cushions with piping-soft edges, two leaning back cushions
  for (const [a, b] of [[z0 + 0.2, -6.4], [-6.4, z1 - 0.2]]) c.fabric.ab(-2.99, -2.24, 0.27, 0.45, a + 0.004, b - 0.004, '#85695a', { r: 0.05, rs: 2, ao: 0.2, jit: 0.14, tile: 0.35 })
  for (const [a, b] of [[z0 + 0.2, -6.4], [-6.4, z1 - 0.2]]) c.fabric.ab(-3.05, -2.86, 0.43, 0.82, a + 0.01, b - 0.01, '#7b6252', { r: 0.055, rs: 2, rz: -0.12, ao: 0.1, jit: 0.14, tile: 0.35 })
  // low table: thick top, tapered splayed legs, a shelf
  const tx = -1.45, tz = -6.4
  c.wood.ab(tx - 0.46, tx + 0.46, 0.38, 0.42, tz - 0.26, tz + 0.26, '#7a5a3c', { r: 0.006, tile: 1.4, ao: 0 })
  c.wood.ab(tx - 0.4, tx + 0.4, 0.37, 0.38, tz - 0.2, tz + 0.2, '#4b3826', { tile: 0.6, ao: 0 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bx = tx + sx * 0.38, bz = tz + sz * 0.19
    c.wood.rod([bx + sx * 0.02, 0.0, bz + sz * 0.015], [bx, 0.38, bz], 0.019, '#3a2a1c', { n: 8, tile: 0.4, swap: true, ao: 0.2 })
  }
  c.wood.ab(tx - 0.36, tx + 0.36, 0.12, 0.135, tz - 0.16, tz + 0.16, '#4b3826', { r: 0.003, tile: 1.0, ao: 0.1 })
}

/* ───────────────────────── foam + fabric acoustic panels ───────────────────────── */
function pyramids(n: number, w: number, h: number, depth: number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = []
  const cw = w / n, ch = h / n
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3()
  const push = (p: THREE.Vector3[], shade: number[]) => {
    a.subVectors(p[1], p[0]); b.subVectors(p[2], p[0]); nn.crossVectors(a, b).normalize()
    for (let i = 0; i < 3; i++) { pos.push(p[i].x, p[i].y, p[i].z); nor.push(nn.x, nn.y, nn.z); uv.push(p[i].x / 0.3, p[i].y / 0.3); col.push(shade[i], shade[i], shade[i]) }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * cw, x1 = x0 + cw, y0 = -h / 2 + j * ch, y1 = y0 + ch
    const tip = v.set((x0 + x1) / 2, (y0 + y1) / 2, depth).clone()
    const A = new THREE.Vector3(x0, y0, 0), B = new THREE.Vector3(x1, y0, 0), C = new THREE.Vector3(x1, y1, 0), D = new THREE.Vector3(x0, y1, 0)
    const s = 0.5 + 0.1 * Math.sin(i * 12.9898 + j * 78.233)
    push([A, B, tip], [s, s, 1]); push([B, C, tip], [s, s, 1]); push([C, D, tip], [s, s, 1]); push([D, A, tip], [s, s, 1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex([...Array(pos.length / 3).keys()])
  return g
}

/** a foam tile glued flat to a wall; `ry` turns local +z to the wall normal (+z: 0, +x: π/2, −x: −π/2, −z: π) */
export function foamPanel(c: Ctx, x: number, y: number, z: number, ry: number, w = 0.6, h = 0.6) {
  const n = c.level >= 1 ? 6 : 4
  c.foam.group(x, y, z, ry, () => {
    c.foam.box(w, h, 0.02, 0, 0, 0.01, '#202125', { ao: 0, tile: 0.3 })
    c.foam.geo(pyramids(n, w - 0.004, h - 0.004, 0.05), '#33353a', 0, 0, 0.02, { ao: 0, tile: 0 })
  })
}

/** a fabric-wrapped absorber in a slim frame, fixed to the wall (z-clips): wood frame, recessed cloth face */
export function fabricPanel(c: Ctx, x: number, y: number, z: number, ry: number, w: number, h: number, cloth: string) {
  c.matte.group(x, y, z, ry, () => {
    const t = 0.05, f = 0.03
    c.satin.ab(-w / 2, w / 2, -h / 2, h / 2, 0.0, 0.006, '#0c0c0d', { ao: 0 }) // dark gap against the wall
    for (const [bx, by, bw, bh] of [[0, h / 2 - f / 2, w, f], [0, -h / 2 + f / 2, w, f], [-w / 2 + f / 2, 0, f, h - 2 * f], [w / 2 - f / 2, 0, f, h - 2 * f]] as const) c.satin.box(bw, bh, t - 0.006, bx, by, 0.006 + (t - 0.006) / 2, '#17181a', { r: 0.003, ao: 0 })
    c.fabric.box(w - 2 * f + 0.004, h - 2 * f + 0.004, t - 0.012, 0, 0, 0.006 + (t - 0.012) / 2 - 0.0, cloth, { r: 0.012, ao: 0, jit: 0.1, tile: 0.4 })
  })
}

/* ───────────────────────── records shelf + wall hardware ───────────────────────── */
export function shelf(c: Ctx) {
  const zf = L.zf
  const x0 = -2.8, x1 = -1.6
  for (const y of [1.7, 2.1]) {
    c.wood.ab(x0, x1, y - 0.02, y + 0.02, zf - 0.26, zf, '#6a4e34', { r: 0.004, tile: 1.2, ao: 0 })
    for (const x of [x0 + 0.1, x1 - 0.1]) c.metal.ab(x - 0.012, x + 0.012, y - 0.2, y - 0.02, zf - 0.006, zf, '#1c1d20', { ao: 0 }) // vertical bracket arm on the wall
    for (const x of [x0 + 0.1, x1 - 0.1]) c.metal.ab(x - 0.012, x + 0.012, y - 0.04, y - 0.02, zf - 0.24, zf, '#1c1d20', { ao: 0 })
  }
  const cols = ['#b6362f', '#e4dcc8', '#2556b0', '#d8b03c', '#15171c', '#7b8a6a', '#9a5a3a']
  for (let i = 0; i < 12; i++) {
    const lean = i > 9 ? 0.16 : 0
    c.matte.box(0.028, 0.31, 0.22, x0 + 0.12 + i * 0.075 + (i > 9 ? 0.03 : 0), 1.72 + 0.155 + 0.0, zf - 0.13, cols[(i * 3) % cols.length], { rz: lean, ao: 0, jit: 0.2 })
  }
  // a stack of cases / boxes on the upper shelf
  c.satin.box(0.3, 0.1, 0.2, x0 + 0.3, 2.12 + 0.05, zf - 0.13, '#202226', { r: 0.004, ao: 0 })
  c.satin.box(0.26, 0.08, 0.18, x0 + 0.33, 2.12 + 0.14, zf - 0.13, '#2a2c30', { r: 0.004, ao: 0 })
}

export function wallHardware(c: Ctx) {
  const { x1, zb, h } = L
  // light switch (right wall, by the door) with conduit dropping from the ceiling
  const sz = -1.95
  c.matte.box(0.012, 0.14, 0.085, x1 - 0.006, 1.22, sz, '#cdc8bb', { r: 0.003, ao: 0 })
  for (const dy of [0.03, -0.03]) c.matte.box(0.008, 0.032, 0.018, x1 - 0.015, 1.22 + dy, sz, '#e8e4d8', { r: 0.002, ao: 0 })
  c.metal.rod([x1 - 0.026, h - 0.05, sz], [x1 - 0.026, 1.31, sz], 0.012, '#6d7076', { n: 8, ao: 0 })
  c.metal.box(0.05, 0.07, 0.07, x1 - 0.025, 1.3, sz, '#5a5d63', { r: 0.004, ao: 0 })
  for (const y of [2.5, 1.9]) c.metal.ab(x1 - 0.034, x1 - 0.012, y - 0.008, y + 0.008, sz - 0.018, sz + 0.018, '#8c9096', { r: 0.002, ao: 0 })
  // duplex outlet on the back wall, a plug in it and the cord leaving to the desk
  const ox = -1.38
  c.matte.box(0.08, 0.12, 0.012, ox, 0.34, zb + 0.006, '#cdc8bb', { r: 0.003, ao: 0 })
  c.satin.box(0.05, 0.045, 0.034, ox, 0.31, zb + 0.029, '#0f0f10', { r: 0.006, ao: 0 })
  return { plug: new THREE.Vector3(ox, 0.31, zb + 0.046) }
}

/* ───────────────────────── ceiling: beams, pipes, fixtures ───────────────────────── */
export function ceiling(c: Ctx) {
  const { x0, x1, zf, zb, h } = L
  const len = zf - zb
  // steel beams (I-section) across the room, bolted to the walls
  for (const z of [-2.8, -5.2, -7.6]) {
    const y = h - 0.2
    c.metal.ab(x0, x1, y + 0.185, y + 0.2, z - 0.07, z + 0.07, '#33363b', { ao: 0 })
    c.metal.ab(x0, x1, y, y + 0.015, z - 0.07, z + 0.07, '#33363b', { ao: 0 })
    c.metal.ab(x0, x1, y + 0.015, y + 0.185, z - 0.006, z + 0.006, '#2d3035', { ao: 0 })
    for (const sx of [x0 + 0.03, x1 - 0.03]) c.metal.ab(sx - 0.03, sx + 0.03, y - 0.01, y + 0.21, z - 0.075, z + 0.075, '#26282c', { ao: 0 })
  }
  // pipes along the room, with clamps, wall flanges at both ends (they enter the walls; nothing floats)
  const pipe = (x: number, y: number, r: number, col: string) => {
    c.metal.cyl(r, r, len, x, y, (zf + zb) / 2, col, { rx: Math.PI / 2, n: 12, ao: 0 })
    for (const z of [zf, zb]) c.metal.cyl(r * 1.8, r * 1.8, 0.012, x, y, z + (z === zf ? -0.006 : 0.006), '#2b2d31', { rx: Math.PI / 2, n: 14, ao: 0 })
    for (const z of [-2.2, -4.0, -5.8, -7.5]) {
      c.metal.ab(x - r * 1.35, x + r * 1.35, y + r * 0.2, y + r * 1.45, z - 0.012, z + 0.012, '#1d1e21', { ao: 0 })
      c.metal.ab(x - 0.005, x + 0.005, y + r, h, z - 0.005, z + 0.005, '#1d1e21', { ao: 0 })
    }
  }
  pipe(-2.75, h - 0.3, 0.06, '#51473d')
  pipe(-2.45, h - 0.26, 0.036, '#40454b')
  pipe(2.9, h - 0.3, 0.045, '#7a2c24')
  // a ventilation box fixed to the ceiling with a slatted grille
  c.satin.ab(1.0, 1.6, h - 0.28, h, -3.6, -2.95, '#26282c', { r: 0.004, ao: 0 })
  for (let i = 0; i < 6; i++) c.matte.ab(1.05, 1.55, h - 0.265 + i * 0.008, h - 0.26 + i * 0.008, -2.96, -2.95, '#08080a', { ao: 0 })
  // surface-mounted fluorescent battens (housing + end caps + tubes). the back one is the tired one
  const batten = (x: number, z: number, len2: number, bright: number) => {
    c.satin.ab(x - 0.07, x + 0.07, h - 0.06, h, z - len2 / 2, z + len2 / 2, '#7d7f7c', { r: 0.004, ao: 0 })
    for (const sz of [-1, 1]) c.satin.ab(x - 0.08, x + 0.08, h - 0.068, h - 0.004, z + sz * len2 / 2 - 0.012, z + sz * len2 / 2 + 0.012, '#7e807d', { r: 0.003, ao: 0 })
    for (const sx of [-0.032, 0.032]) c.glow.ab(x + sx - 0.012, x + sx + 0.012, h - 0.075, h - 0.062, z - len2 / 2 + 0.03, z + len2 / 2 - 0.03, '#dfe9ff', { i: bright * 0.8, ao: 0 })
  }
  batten(0.2, -3.6, 1.2, 1.0)
  batten(0.2, -6.6, 1.2, 0.5)
  // track with two spot cans over the desk (fixed to the ceiling, aimed at the workstation)
  const ty = h - 0.02
  c.metal.ab(-1.3, 1.5, ty - 0.012, ty + 0.02, -7.42, -7.38, '#101012', { ao: 0 })
  for (const sx of [-0.4, 0.95]) {
    c.metal.ab(sx - 0.015, sx + 0.015, ty - 0.06, ty - 0.012, -7.43, -7.37, '#101012', { ao: 0 })
    c.matte.group(sx, ty - 0.12, -7.4, 0, () => {
      c.satin.cyl(0.042, 0.052, 0.14, 0, 0, 0, '#15161a', { n: 16, ao: 0 })
      c.glow.cyl(0.044, 0.044, 0.004, 0, -0.069, 0, '#ffe2bf', { n: 14, ao: 0, i: 1.2 })
    }, 0.45)
  }
  // blue LED strip in an aluminium channel at the top of the back wall (washes the ceiling)
  c.metal.ab(x0 + 0.15, x1 - 0.15, h - 0.075, h - 0.045, zb, zb + 0.032, '#4a4d53', { ao: 0 })
  c.glow.ab(x0 + 0.17, x1 - 0.17, h - 0.068, h - 0.057, zb + 0.012, zb + 0.032, '#a2b5d1', { i: 0.65, ao: 0 })
  // the red work lamp: a caged bulb hung on its cord from the ceiling, by the bio wall
  const rl = { x: 2.3, y: 2.35, z: -2.9 }
  c.matte.rod([rl.x, h, rl.z], [rl.x, rl.y + 0.1, rl.z], 0.004, '#0b0b0c', { n: 5, ao: 0 })
  c.metal.cyl(0.03, 0.03, 0.04, rl.x, rl.y + 0.085, rl.z, '#2a2c30', { n: 10, ao: 0 })
  c.glow.geo(new THREE.SphereGeometry(0.04, 12, 10), '#ffc09a', rl.x, rl.y, rl.z, { i: 1.1, ao: 0 })
  for (const k of [0, 1, 2]) c.metal.geo(new THREE.TorusGeometry(0.056, 0.0016, 4, 18), '#6a6d73', rl.x, rl.y + 0.014 - k * 0.032, rl.z, { rx: Math.PI / 2, ao: 0 })
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.metal.rod([rl.x + Math.cos(a) * 0.056, rl.y + 0.045, rl.z + Math.sin(a) * 0.056], [rl.x + Math.cos(a) * 0.03, rl.y - 0.07, rl.z + Math.sin(a) * 0.03], 0.0016, '#6a6d73', { n: 4, ao: 0 }) }
}

export const RED_LAMP = { x: 2.3, y: 2.35, z: -2.9 }


/** Connected existing interface, displays, and suspended broadband absorbers.
 * All parts join the existing material batches; dimensions are in metres. */
export function studioHardware(c: Ctx) {
  const T = PLACE.deskTop;
  if (c.level >= 1) {
    for (const z of [-6.1,-4.9]) {
      c.wood.box(1.5,.09,.85,.2,2.56,z,'#4b4134',{r:.008,ao:0});
      c.fabric.box(1.48,.085,.83,.2,2.55,z,'#706f65',{r:.016,rs:1,ao:0,tile:.35});
      for (const x of [-.43,.83]) for (const dz of [-.30,.30]) {
        c.metal.rod([x,2.61,z+dz],[x,L.h-.025,z+dz],.0025,'#878988',{n:5,ao:0});
        c.metal.box(.025,.008,.025,x,L.h-.02,z+dz,'#6f7478',{ao:0});
      }
    }
    for (const display of [PLACE.hero,PLACE.daw]) {
      c.matte.tube([new THREE.Vector3(display.x,display.y-.08,display.z-.054),new THREE.Vector3(display.x+.04,.86,display.z-.10),new THREE.Vector3(display.x+.06,.70,-8.49)],.0035,'#161719',{ao:0});
    }
    c.matte.tube([new THREE.Vector3(-.90,T+.035,-7.95),new THREE.Vector3(-.84,T+.006,-7.90),new THREE.Vector3(-.79,T+.005,-8.42),new THREE.Vector3(-.70,.68,-8.49)],.003,'#191a1b',{ao:0});
  }
}
