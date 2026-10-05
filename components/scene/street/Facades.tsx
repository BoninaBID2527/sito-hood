'use client'

import { useWorldFrame } from '@/hooks/useWorldFrame'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rng, smoothstep } from '@/lib/math'
import { tileUV, worldUV, GeoBuilder } from '@/lib/geo'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'
import { streetMat } from './materials'
import { PLAZA, SEGS, STREET_SKIP, allWindows, segAt, streetLevelItems, type BrickKind } from './layout'
import { wallWithOpenings, withWhite, type Hole } from './facadeBuild'
import { FIRE_ESCAPES } from './FireEscapes'
import { WINDOW_VARIANTS, type WindowVariant } from '@/lib/textures'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)

/** how deep the window sash / door plane sits behind the wall face (the wall is this thick where it is cut) */
const WIN_DEPTH = 0.28
const DOOR_DEPTH = 0.24
const SHUTTER_DEPTH = 0.2
/** window plane = 1.0 × 1.55 m, scaled per window */
const WIN_H = 1.55

/** openings (windows + ground-floor doors/shutters) that fall on one wall segment, as holes for the wall builder */
function holesFor(side: -1 | 1, zNear: number, zFar: number): Hole[] {
  const holes: Hole[] = []
  for (const d of allWindows()) {
    if (d.side !== side || d.z > zNear - 0.05 || d.z < zFar + 0.05) continue
    const hh = (WIN_H * d.h) / 2
    holes.push({ z0: d.z + d.w / 2, z1: d.z - d.w / 2, y0: d.y - hh, y1: d.y + hh, depth: WIN_DEPTH })
  }
  const lv = streetLevelItems()
  for (const t of lv.shutters.flat()) if (t.side === side && t.z < zNear && t.z > zFar) holes.push({ z0: t.z + 1.45, z1: t.z - 1.45, y0: 0, y1: 2.8, depth: SHUTTER_DEPTH })
  for (const t of lv.doors.flat()) if (t.side === side && t.z < zNear && t.z > zFar) holes.push({ z0: t.z + 0.575, z1: t.z - 0.575, y0: 0, y1: 2.355, depth: DOOR_DEPTH })
  return holes
}

/** z-ranges at street level that must stay free of piers (openings, fire-escape ladders) */
function groundBlockers(side: -1 | 1) {
  const out: [number, number][] = []
  const lv = streetLevelItems()
  for (const t of lv.shutters.flat()) if (t.side === side) out.push([t.z - 1.6, t.z + 1.6])
  for (const t of lv.doors.flat()) if (t.side === side) out.push([t.z - 0.9, t.z + 0.9])
  for (const f of FIRE_ESCAPES) if (f.side === side) out.push([f.z - 1.9, f.z + 1.9])
  for (const k of STREET_SKIP) if (k.side === side) out.push([k.z - 1.2, k.z + 1.2])
  return out
}

/** Brick / plaster / concrete walls with real openings, piers, belt courses, stepped brick cornices, parapets and roof structures. */
export function Walls() {
  const { mats, items, relief } = useMemo(() => {
    const mats: Record<string, THREE.MeshStandardMaterial> = {}
    const kinds: BrickKind[] = ['red', 'dark', 'weathered', 'plaster', 'concrete']
    const wallMat = (k: BrickKind, tint: string, seed: number) =>
      streetMat({ map: A.brick[k].map, roughness: 0.92, color: tint, side: THREE.FrontSide, aoBase: 0.4, brick: true, bump: A.brick[k].bump, bumpAmt: k === 'concrete' ? 0.4 : 1.4, seed, vertexColors: true })
    for (const k of kinds) mats[k] = wallMat(k, '#ffffff', kinds.indexOf(k) * 3.7)
    const tintMat = (k: BrickKind, tint: string) => {
      const key = `${k}-${tint}`
      if (!mats[key]) mats[key] = wallMat(k, tint, kinds.indexOf(k) * 3.7 + (tint.charCodeAt(2) % 7))
      return mats[key]
    }
    // cast stone / concrete trim: lighter and rougher than the old near-black slab, with its own weathering
    A.sidewalk.repeat.set(1, 1)
    const stone = streetMat({ map: A.sidewalk, color: '#6f6b63', roughness: 0.94, aoBase: 0.45, macro: 1.0, seed: 5.5, vertexColors: true })
    const trim = streetMat({ color: '#3b3733', roughness: 0.9, aoBase: 0.5, vertexColors: true })
    mats.stone = stone
    mats.trim = trim

    const items: { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number]; rot: [number, number, number] }[] = []
    const push = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0]) => items.push({ geo: withWhite(geo), mat, pos, rot })

    // ── the wall faces: real openings (windows, doors, shutters cut through the wall)
    for (const s of SEGS) push(wallWithOpenings({ side: s.side, x: s.side * s.hw, zNear: s.z0, zFar: s.z1, h: s.h, holes: holesFor(s.side, s.z0, s.z1) }), tintMat(s.kind, s.tint))
    // wall returns where the building line steps
    for (const side of [-1, 1] as const) {
      const list = SEGS.filter((s) => s.side === side).sort((a, b) => b.z0 - a.z0)
      for (let i = 0; i < list.length - 1; i++) {
        const near = list[i], far = list[i + 1]
        const dx = Math.abs(near.hw - far.hw)
        if (dx < 0.01) continue
        const h = Math.max(near.h, far.h)
        const g = new THREE.PlaneGeometry(dx, h)
        tileUV(g, dx, h, 2.4)
        const protrudes = far.hw < near.hw
        const x = side * ((near.hw + far.hw) / 2)
        push(g, tintMat(far.kind, far.tint), [x, h / 2, near.z1], [0, protrudes ? 0 : Math.PI, 0])
      }
    }
    // end of alley → plaza walls (with their own openings) + connecting faces
    for (const side of [-1, 1] as const) {
      const last = SEGS.filter((s) => s.side === side).sort((a, b) => a.z1 - b.z1)[0]
      push(wallWithOpenings({ side, x: side * PLAZA.hw, zNear: PLAZA.z0, zFar: PLAZA.z1, h: 20, holes: holesFor(side, PLAZA.z0, PLAZA.z1) }), mats[side === -1 ? 'dark' : 'weathered'])
      const dx = PLAZA.hw - last.hw
      const g2 = new THREE.PlaneGeometry(dx, last.h)
      tileUV(g2, dx, last.h, 2.4)
      push(g2, tintMat(last.kind, last.tint), [side * (last.hw + dx / 2), last.h / 2, last.z1])
    }
    // back of the alley (behind the camera start) so pointer parallax never reveals the void
    const back = new THREE.PlaneGeometry(8, 24)
    tileUV(back, 8, 24, 2.4)
    push(back, mats.dark, [0, 12, 30], [0, Math.PI, 0])

    // ── relief: what makes a facade a BUILT thing instead of a textured plane
    const r = rng(6161)
    const stoneG = new GeoBuilder(), brickBy = new Map<THREE.Material, GeoBuilder>(), roofG = new GeoBuilder(), woodG = new GeoBuilder(), steelG = new GeoBuilder(), cap = new GeoBuilder()
    const brick = (m: THREE.Material) => { if (!brickBy.has(m)) brickBy.set(m, new GeoBuilder()); return brickBy.get(m)! }
    const facadeRun = (s: { side: -1 | 1; hw: number; z0: number; z1: number; h: number; kind: BrickKind; tint: string }, plaza = false) => {
      const side = s.side, o = side, inw = -side
      const len = s.z0 - s.z1, zc = (s.z0 + s.z1) / 2
      const xw = side * s.hw
      const bm = plaza ? mats[side === -1 ? 'dark' : 'weathered'] : tintMat(s.kind, s.tint)
      const bb = brick(bm)
      // belt courses: the lower string course under the first window row, and a slim floor line between every pair of storeys
      stoneG.box(0.16, 0.24, len, xw + inw * 0.04, 4.38, zc)
      if (!plaza) for (let y = 6.975; y < s.h - 2.2; y += 3.35) stoneG.box(0.1, 0.13, len, xw + inw * 0.04, y, zc)
      else for (let y = 6.3; y < s.h - 2.2; y += 3.4) stoneG.box(0.1, 0.13, len, xw + inw * 0.04, y, zc)
      // brick piers every second bay (window pitch 3.0 m → boundary between two windows), skipping openings and ladders
      const blockers = groundBlockers(side)
      const pitch = plaza ? 3.4 : 3.0
      const first = plaza ? s.z0 - 2 - pitch / 2 : s.z0 - 1.4 - pitch / 2
      for (let z = first, j = 0; z > s.z1 + 1; z -= pitch, j++) {
        if (j % 2 === 1 && !plaza) continue
        if (plaza && j % 3 !== 0) continue
        if (blockers.some(([a, b]) => z > a && z < b)) continue
        const ph = s.h - 1.1
        bb.add(worldUV(new THREE.BoxGeometry(0.2, ph, 0.5), 2.4, 0, 0, 0), xw + inw * 0.1, 0.16 + ph / 2, z)
        // pier cap: a small stone shoulder where the pier meets the storey line below the cornice
        stoneG.box(0.26, 0.1, 0.62, xw + inw * 0.13, s.h - 0.97, z)
      }
      // stepped brick cornice (corbels) + parapet + coping
      for (const [d, hh, y] of [[0.13, 0.2, s.h - 0.96], [0.25, 0.2, s.h - 0.76], [0.37, 0.22, s.h - 0.55]] as const) bb.add(worldUV(new THREE.BoxGeometry(d, hh, len + 0.1), 2.4), xw + inw * d / 2, y, zc)
      stoneG.box(0.52, 0.38, len + 0.2, xw + inw * 0.26, s.h - 0.25, zc)
      const pt = 0.34
      bb.add(worldUV(new THREE.BoxGeometry(pt, 0.95, len), 2.4), xw + o * pt / 2, s.h + 0.47, zc)
      stoneG.box(pt + 0.14, 0.08, len + 0.1, xw + o * pt / 2 + inw * 0.04, s.h + 0.99, zc)
      // roof structures — silhouettes, mostly seen from far away and against the sky: chimney stacks, vents, a water tank, a stair bulkhead
      const nStack = plaza ? 0 : r.int(1, 3)
      for (let i = 0; i < nStack; i++) {
        const z = s.z0 - 1.5 - r() * (len - 3)
        const x = xw + o * (1.2 + r() * 2.2)
        const w = 0.8 + r() * 0.5, hh = 1.6 + r() * 2.2
        bb.add(worldUV(new THREE.BoxGeometry(w, hh, w), 2.4), x, s.h + hh / 2, z)
        stoneG.box(w + 0.22, 0.12, w + 0.22, x, s.h + hh + 0.06, z)
        if (r() < 0.6) roofG.cyl(0.07, 0.09, 0.9, x, s.h + hh + 0.6, z, 6)
      }
      if (!plaza && r() < 0.55) {
        const z = s.z0 - 3 - r() * (len - 6), x = xw + o * (2.4 + r() * 1.5)
        // wooden water tank on a steel stand
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) steelG.cyl(0.05, 0.05, 2.6, x + dx * 1.05, s.h + 1.3, z + dz * 1.05, 6)
        steelG.box(2.5, 0.12, 2.5, x, s.h + 2.6, z)
        woodG.cyl(1.45, 1.45, 2.5, x, s.h + 2.6 + 1.31, z, 16)
        roofG.cyl(0.0, 1.62, 0.9, x, s.h + 2.6 + 2.56 + 0.45, z, 16)
        for (const hy of [0.5, 1.3, 2.1]) steelG.cyl(1.49, 1.49, 0.05, x, s.h + 2.6 + 0.12 + hy, z, 16)
      }
      if (!plaza && r() < 0.5) {
        const z = s.z0 - 3 - r() * (len - 6), x = xw + o * (2.2 + r() * 2.0)
        bb.add(worldUV(new THREE.BoxGeometry(2.6, 2.3, 2.8), 2.4), x, s.h + 1.15, z)
        stoneG.box(2.8, 0.14, 3.0, x, s.h + 2.37, z)
        cap.box(0.1, 1.9, 0.9, x + inw * 1.32, s.h + 0.95, z)
      }
      if (!plaza && r() < 0.5) {
        const z = s.z0 - 2 - r() * (len - 4), x = xw + o * (1 + r() * 2.5)
        steelG.cyl(0.025, 0.025, 4 + r() * 3, x, s.h + 2.5, z, 5)
        steelG.box(0.04, 0.04, 1.1, x, s.h + 3.6, z)
      }
    }
    for (const s of SEGS) facadeRun(s)
    for (const side of [-1, 1] as const) facadeRun({ side, hw: PLAZA.hw, z0: PLAZA.z0, z1: PLAZA.z1, h: 20, kind: 'dark', tint: '#ffffff' }, true)

    const reliefParts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []
    const addRelief = (b: GeoBuilder, mat: THREE.Material, tile = 0) => { if (b.empty) return; const g = b.build(); if (tile) worldUV(g, tile); reliefParts.push({ geo: withWhite(g), mat }) }
    addRelief(stoneG, stone, 1.4)
    for (const [m, b] of brickBy) addRelief(b, m)
    const roofMat = streetMat({ color: '#2c2a27', roughness: 0.85, metalness: 0.2, aoBase: 0.6, vertexColors: true })
    const woodMat = streetMat({ color: '#5a4630', roughness: 0.95, aoBase: 0.5, vertexColors: true })
    const steelMat = streetMat({ color: '#2a2b2e', roughness: 0.6, metalness: 0.7, aoBase: 0.6, vertexColors: true })
    const capMat = streetMat({ color: '#6b665c', roughness: 0.9, aoBase: 0.5, vertexColors: true })
    addRelief(roofG, roofMat); addRelief(woodG, woodMat); addRelief(steelG, steelMat); addRelief(cap, capMat)
    return { mats: { ...mats, roofMat, woodMat, steelMat, capMat } as Record<string, THREE.MeshStandardMaterial>, items, relief: reliefParts }
  }, [])

  // merge every wall piece that shares a material into one geometry
  const merged = useMemo(() => {
    const by = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1)
    for (const it of items) {
      const g = it.geo.clone()
      m.compose(new THREE.Vector3(...it.pos), q.setFromEuler(e.set(...it.rot)), one)
      g.applyMatrix4(m)
      if (!by.has(it.mat)) by.set(it.mat, [])
      by.get(it.mat)!.push(g)
    }
    for (const rp of relief) { const g = rp.geo.clone(); if (!by.has(rp.mat)) by.set(rp.mat, []); by.get(rp.mat)!.push(g) }
    return [...by.entries()].map(([mat, list]) => ({ mat, geo: mergeGeometries(list, false)! }))
  }, [items, relief])

  useEffect(
    () => () => {
      items.forEach((i) => i.geo.dispose())
      relief.forEach((i) => i.geo.dispose())
      merged.forEach((m) => m.geo.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [items, relief, mats, merged],
  )

  return (
    <group>
      {merged.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} castShadow receiveShadow />
      ))}
    </group>
  )
}

const tmpC = new THREE.Color()
/** shared by every window material: how much of the night has arrived, and the late-hour lull */
const winU = { t: { value: 0 }, late: { value: 0 } }
/** emissive = base + windowsGlow × gain (null = never emits) */
const EMIT: Record<WindowVariant, [number, number] | null> = {
  dark: null, warm: [0.12, 2.1], warm2: [0.14, 2.2], cool: [0.1, 1.5], tv: [0.2, 1.7], blind: [0.05, 0.55], boarded: null,
  barred: [0.0, 0.18], sheet: [0.04, 0.85], shutter: null, broken: null, ac: null,
}

/** Windows: the sash/glass sits at the back of the shaft cut into the wall; a stone surround (sill, drip, lintel, casing) is instanced. */
export function Windows() {
  const data = useMemo(() => allWindows(), [])

  const built = useMemo(() => {
    const variants = WINDOW_VARIANTS
    const plane = new THREE.PlaneGeometry(1.0, WIN_H)
    // the stone surround of one unit window (local: x along the wall, y up, +z toward the street); instanced and scaled by (w, h)
    const sg = new GeoBuilder()
    const hh = WIN_H / 2
    sg.rbox(1.34, 0.11, 0.2, 0, -hh - 0.04, 0.1, 0.018) // sill slab (projects 20 cm)
    sg.box(1.38, 0.035, 0.24, 0, -hh - 0.115, 0.12) // drip lip
    sg.rbox(1.36, 0.2, 0.11, 0, hh + 0.12, 0.055, 0.015) // lintel
    sg.box(1.2, 0.05, 0.14, 0, hh + 0.245, 0.07) // lintel cap
    for (const sx of [-1, 1]) sg.box(0.1, WIN_H + 0.12, 0.05, sx * (0.5 + 0.05), 0.0, 0.025) // casing
    const surroundGeo = sg.build()
    const surround = streetMat({ color: '#75716a', roughness: 0.94, aoBase: 0.55, macro: 1.0, seed: 2.2 })
    const meshes: THREE.InstancedMesh[] = []
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.MeshStandardMaterial[] = []
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
    const eu = new THREE.Euler()
    const surrounds: THREE.Matrix4[] = []

    for (const v of variants) {
      const list = data.filter((d) => d.variant === v)
      if (!list.length) continue
      const tex = A.windows[v]
      const lit = EMIT[v] !== null
      const mat = new THREE.MeshStandardMaterial({
        map: tex, roughness: lit ? 0.7 : 0.25, metalness: lit ? 0 : 0.3,
        emissive: lit ? new THREE.Color('#ffffff') : new THREE.Color('#000000'), emissiveMap: lit ? tex : null, emissiveIntensity: 0.4,
      })
      mat.userData.variant = v
      // per-instance tone also drives the glow (instanceColor only multiplies the diffuse term by default)
      // each window has its own hour: it comes alive when the evening reaches its threshold; a few go dark late
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWinT = winU.t
        sh.uniforms.uLate = winU.late
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aWin;\nvarying vec2 vWin;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;')
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vWin;\nuniform float uWinT;\nuniform float uLate;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif\n  totalEmissiveRadiance *= mix(0.4, 1.0, smoothstep(vWin.x - 0.05, vWin.x + 0.05, uWinT)) * (1.0 - uLate * step(vWin.y, 0.16) * 0.88);')
      }
      mat.customProgramCacheKey = () => 'win-emit2'
      const vg = plane.clone()
      geos.push(vg)
      const aWin = new Float32Array(list.length * 2)
      list.forEach((d, i) => {
        const h1 = Math.abs(Math.sin(d.z * 12.9898 + d.y * 78.233 + d.side * 4.1) * 43758.5453) % 1
        const h2 = Math.abs(Math.sin(d.z * 39.346 + d.y * 11.135 + d.side * 7.7) * 24634.6345) % 1
        aWin[i * 2] = 0.04 + Math.pow(h1, 0.8) * 0.9
        aWin[i * 2 + 1] = h2
      })
      vg.setAttribute('aWin', new THREE.InstancedBufferAttribute(aWin, 2))
      const im = new THREE.InstancedMesh(vg, mat, list.length)
      list.forEach((d, i) => {
        // the sash sits at the back of the shaft (WIN_DEPTH behind the wall face)
        p.set(d.x + d.side * WIN_DEPTH, d.y, d.z)
        q.setFromEuler(eu.set(0, rotFor(d.side), 0))
        s.set(d.w, d.h, 1)
        m4.compose(p, q, s)
        im.setMatrixAt(i, m4)
        const t = d.tone ?? 1
        im.setColorAt(i, tmpC.setRGB(t * (0.92 + 0.16 * Math.sin(i * 3.1)), t * (0.86 + 0.18 * Math.sin(i * 12.9)), t * (0.74 + 0.3 * Math.sin(i * 7.3))))
        s.set(1, 1, 1)
        // the stone surround sits on the wall face
        p.set(d.x, d.y, d.z)
        surrounds.push(new THREE.Matrix4().compose(p.clone(), q.clone(), new THREE.Vector3(d.w, d.h, 1)))
      })
      im.instanceMatrix.needsUpdate = true
      im.frustumCulled = false
      meshes.push(im)
      mats.push(mat)
    }
    const sIm = new THREE.InstancedMesh(surroundGeo, surround, surrounds.length)
    sIm.castShadow = true
    sIm.receiveShadow = true
    surrounds.forEach((m, i) => sIm.setMatrixAt(i, m))
    sIm.instanceMatrix.needsUpdate = true
    sIm.frustumCulled = false
    meshes.push(sIm)
    return { meshes, mats, geos: [plane, surroundGeo, ...geos], surround }
  }, [data])

  useWorldFrame('alley', () => {
    const w = palette.windows
    winU.t.value = w
    winU.late.value = smoothstep(0.34, 0.5, rt.smooth) * (1 - smoothstep(0.7, 0.72, rt.smooth))
    for (const m of built.mats) {
      const v = m.userData.variant as string
      const e = EMIT[v as WindowVariant]
      m.emissiveIntensity = e ? e[0] + w * e[1] : 0
    }
  })

  useEffect(
    () => () => {
      built.meshes.forEach((m) => m.dispose())
      built.mats.forEach((m) => m.dispose())
      built.geos.forEach((g) => g.dispose())
      built.surround.dispose()
    },
    [built],
  )

  return (
    <group>
      {built.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

/** Roller shutters and metal doors at street level: set into openings cut through the wall (instanced per texture variant). */
export function StreetLevel() {
  const built = useMemo(() => {
    const lv = streetLevelItems()
    type T = { side: -1 | 1; z: number }
    const { shutters, doors } = lv
    const meshes: THREE.InstancedMesh[] = []
    const disposables: { dispose(): void }[] = []
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), eu = new THREE.Euler()
    const make = (list: T[], geo: THREE.BufferGeometry, tex: THREE.Texture, y: number, depth: number) => {
      if (!list.length) return
      const mat = streetMat({ map: tex, roughness: 0.55, metalness: 0.55, color: '#ffffff', aoBase: 0.55 })
      const im = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((t, i) => {
        const x = segAt(t.side, t.z).hw
        p.set(t.side * (x + depth), y, t.z)
        q.setFromEuler(eu.set(0, rotFor(t.side), 0))
        m4.compose(p, q, sc)
        im.setMatrixAt(i, m4)
      })
      im.frustumCulled = false
      meshes.push(im)
      disposables.push(mat, im)
    }
    const shGeo = new THREE.PlaneGeometry(2.9, 2.8)
    const dGeo = new THREE.PlaneGeometry(1.15, 2.35)
    disposables.push(shGeo, dGeo)
    shutters.forEach((l, i) => make(l, shGeo, A.shutters[i], 1.4, SHUTTER_DEPTH - 0.02))
    doors.forEach((l, i) => make(l, dGeo, A.doors[i], 1.18, DOOR_DEPTH - 0.02))
    // housings / frames: the roller box over a shutter, a head over a door
    const frame = streetMat({ color: '#2b2a28', roughness: 0.8 })
    const fGeo = new THREE.BoxGeometry(0.3, 0.32, 3.2)
    const dfGeo = new THREE.BoxGeometry(0.22, 0.2, 1.45)
    disposables.push(frame, fGeo, dfGeo)
    const addFrames = (lists: T[][], geo: THREE.BufferGeometry, y: number, off: number) => {
      const flat = lists.flat()
      if (!flat.length) return
      const im = new THREE.InstancedMesh(geo, frame, flat.length)
      flat.forEach((t, i) => {
        const x = segAt(t.side, t.z).hw
        p.set(t.side * x - t.side * off, y, t.z)
        q.setFromEuler(eu.set(0, 0, 0))
        m4.compose(p, q, sc)
        im.setMatrixAt(i, m4)
      })
      im.frustumCulled = false
      meshes.push(im)
      disposables.push(im)
    }
    addFrames(shutters, fGeo, 2.95, 0.15)
    addFrames(doors, dfGeo, 2.46, 0.12)
    return { meshes, disposables }
  }, [])

  useEffect(() => () => built.disposables.forEach((d) => d.dispose()), [built])
  return (
    <group>
      {built.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

