'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { alterco } from '@/data/project'
import { Atlas, FONT, type Cell } from '@/lib/graffiti'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { rig } from '@/lib/trackRig'
import { STATIONS } from '@/lib/installation'
import { smoothstep } from '@/lib/math'
import { cellGeometry } from './street/atlasDecals'

/**
 * Environmental editorial typography for the seven tracks.
 * No UI cards: the number and the title are *built into the space* around each object — scaled, stacked, vertical, crossed,
 * partly hidden — and only the composition near the camera is rendered. Everything comes from `alterco.tracks` (no invented text).
 * One system (Anton + the same cream/amber), seven different compositions. Title-and-position-based behaviours only:
 *   01 assembling · 02 lifting · 03 rigid & frontal · 04 monumental & vertical · 05 loosening · 06 two masses crossing · 07 settling.
 */
type Style = 'solid' | 'outline' | 'ghost' | 'amber'
interface Item {
  /** text — 'N' is the track number, 'T1…' the title lines */
  text: string
  /** world height of the glyph box (m) */
  h: number
  /** station-local position (x right, y up, z toward the camera) and rotation */
  pos: [number, number, number]
  rot?: [number, number, number]
  style: Style
  /** base opacity */
  a: number
}

const num = (i: number) => String(i + 1).padStart(2, '0')
const title = (i: number) => alterco.tracks[i].title.replace(/è/g, 'È').toUpperCase()
const words = (i: number) => title(i).split(' ')

/** compositions (station-local metres; the object itself is 2.15 × 3.0 at the origin) */
function compose(i: number): Item[] {
  const w = words(i)
  switch (i) {
    case 0: // POTREI — still assembling, partly obscured
      return [
        { text: w.join(' '), h: 1.5, pos: [1.35, -0.45, -0.8], style: 'solid', a: 0.92 },
        { text: num(i), h: 0.95, pos: [-2.4, 1.85, -0.2], style: 'outline', a: 0.8 },
      ]
    case 1: // WE / MADE / IT — open vertical space, lifting
      return [
        { text: w[0], h: 1.05, pos: [1.75, 1.35, -0.35], style: 'solid', a: 0.95 },
        { text: w[1], h: 1.05, pos: [2.05, 0.2, -0.35], style: 'solid', a: 0.95 },
        { text: w[2], h: 1.05, pos: [1.6, -0.95, -0.35], style: 'amber', a: 0.95 },
        { text: num(i), h: 1.9, pos: [-2.3, 2.1, -1.0], style: 'outline', a: 0.55 },
      ]
    case 2: // NON È SWAG — direct, frontal, rigid
      return [
        { text: num(i), h: 3.3, pos: [0, 0.3, -0.9], style: 'ghost', a: 0.5 },
        { text: w.join(' '), h: 1.15, pos: [0, -2.05, 0.14], style: 'solid', a: 0.98 },
      ]
    case 3: // GIUDIZIO DIVINO — monumental, vertical, architectural
      return [
        { text: num(i), h: 5.2, pos: [-3.5, 0.5, -1.7], style: 'solid', a: 0.8 },
        { text: w[0], h: 1.15, pos: [2.5, 0.2, -0.5], rot: [0, 0, Math.PI / 2], style: 'solid', a: 0.96 },
        { text: w[1], h: 1.15, pos: [3.75, -0.5, -0.9], rot: [0, 0, Math.PI / 2], style: 'outline', a: 0.9 },
      ]
    case 4: // LASCIARSI / ANDARE — negative space, loosening
      return [
        { text: w[0], h: 0.55, pos: [0.5, 1.95, -0.25], style: 'solid', a: 0.9 },
        { text: w[1], h: 0.55, pos: [-0.4, -1.95, -0.35], style: 'solid', a: 0.9 },
        { text: num(i), h: 0.8, pos: [2.0, 0.2, -0.3], style: 'outline', a: 0.7 },
      ]
    case 5: // PAROLE / CONTRASTANTI — two masses facing / crossing in depth
      return [
        { text: w[0], h: 1.15, pos: [-2.1, 0.9, 0.25], rot: [0, 0.6, 0], style: 'solid', a: 0.96 },
        { text: w[1], h: 0.8, pos: [2.2, -0.8, -0.5], rot: [0, -0.6, 0], style: 'outline', a: 0.92 },
        { text: num(i), h: 1.0, pos: [0, 2.35, -0.3], style: 'ghost', a: 0.6 },
      ]
    default: // STARE / BENE — breathing room, resolving
      return [
        { text: w[0], h: 0.92, pos: [0, 2.0, -0.35], style: 'solid', a: 0.9 },
        { text: w[1], h: 0.92, pos: [0, -2.0, -0.35], style: 'solid', a: 0.9 },
        { text: num(i), h: 0.7, pos: [-1.9, 0.0, -0.2], style: 'outline', a: 0.65 },
      ]
  }
}

const COMPS = Array.from({ length: 7 }, (_, i) => compose(i))

function drawText(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, style: Style) {
  ctx.clearRect(0, 0, w, h)
  const px = h * 0.8
  ctx.font = `${px}px ${FONT.anton}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  const x = w / 2, y = h * 0.84
  if (style === 'outline') {
    ctx.strokeStyle = '#efe7d8'
    ctx.lineWidth = Math.max(2, h * 0.028)
    ctx.strokeText(text, x, y)
    return
  }
  if (style === 'ghost') ctx.fillStyle = 'rgba(239,231,216,0.78)'
  else if (style === 'amber') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#ffcf9a'); g.addColorStop(1, '#ff9a4a')
    ctx.fillStyle = g
  } else {
    const g = ctx.createLinearGradient(0, h * 0.1, 0, h)
    g.addColorStop(0, '#f6f0e3'); g.addColorStop(1, '#cfc4ae')
    ctx.fillStyle = g
  }
  ctx.fillText(text, x, y)
}

function measure(text: string, h: number) {
  const c = document.createElement('canvas').getContext('2d')!
  c.font = `${h * 0.8}px ${FONT.anton}`
  return Math.ceil(c.measureText(text).width + h * 0.3)
}

const REVEAL_VERT = ''
void REVEAL_VERT

export function TrackTypography() {
  const kit = useMemo(() => {
    // one atlas for every composition (a single texture, one material program)
    const LOGICAL = 150 // px per world metre
    const specs: { id: string; w: number; h: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void }[] = []
    COMPS.forEach((items, i) =>
      items.forEach((it, k) => {
        const ph = Math.round(it.h * LOGICAL)
        const pw = Math.min(1800, measure(it.text, ph))
        specs.push({ id: `${i}_${k}`, w: pw, h: ph, draw: (c, w, h) => drawText(c, w, h, it.text, it.style) })
      }),
    )
    // big numerals dominate the sheet: scale the whole atlas to the device tier
    const sc = rt.quality.level >= 2 ? 0.75 : 0.5
    const atlas = new Atlas(2048, 3072, sc).pack(specs as never)
    const tex = atlas.texture()
    tex.generateMipmaps = true
    const uniformSets: { uRv: { value: number }; uObs: { value: number } }[] = []
    const mk = (cell: Cell, a: number) => {
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0, color: new THREE.Color(1.15, 1.1, 1.0) })
      const u = { uRv: { value: 0 }, uObs: { value: 0 } }
      uniformSets.push(u)
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uRv = u.uRv
        sh.uniforms.uObs = u.uObs
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uRv;\nuniform float uObs;\nfloat th(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }')
          .replace('#include <map_fragment>', '#include <map_fragment>\n  float tn = th(floor(vMapUv * vec2(54.0, 24.0)));\n  diffuseColor.a *= step(tn * 0.92, uRv * 1.1 - 0.04);\n  float tb = step(0.5, fract(vMapUv.y * 6.0 + 0.35));\n  diffuseColor.a *= mix(1.0, 0.18 + 0.82 * tb, uObs);')
      }
      m.customProgramCacheKey = () => 'track-type-1'
      return { m, geo: cellGeometry(cell), cell, a, u }
    }
    const planes = COMPS.map((items, i) => items.map((it, k) => ({ ...mk(atlas.cells[`${i}_${k}`], it.a), it, k })))
    return { atlas, tex, planes }
  }, [])

  useEffect(
    () => () => {
      kit.tex.dispose()
      kit.planes.flat().forEach((p) => { p.m.dispose(); p.geo.dispose() })
    },
    [kit],
  )

  const groups = useRef<(THREE.Group | null)[]>([])
  const meshes = useRef<(THREE.Mesh | null)[][]>(COMPS.map(() => []))
  // per-plane smoothed reveal and static facing data
  const state = useMemo(
    () =>
      COMPS.map((items, i) =>
        items.map((it) => {
          const st = STATIONS[i]
          const c = Math.cos(st.yaw), s = Math.sin(st.yaw)
          // station-local → world (rotation about y)
          const wx = st.pos.x + it.pos[0] * c + it.pos[2] * s
          const wz = st.pos.z - it.pos[0] * s + it.pos[2] * c
          const ry = st.yaw + (it.rot?.[1] ?? 0)
          return { rv: 0, wx, wy: st.pos.y + it.pos[1], wz, nx: Math.sin(ry), nz: Math.cos(ry) }
        }),
      ),
    [],
  )

  useFrame(({ camera }, dt) => {
    const p = rt.smooth
    const on = rt.world === 'alley' && p > 0.3 && p < 0.7
    const st = useStore.getState()
    const red = rt.reducedMotion
    const t = rt.time
    const recede = smoothstep(0.6, 0.665, p)
    // portrait: the composition is gathered toward the middle so number + title + artwork fit the narrow frame
    const asp = rt.aspect
    const lat = asp < 1 ? 0.4 : asp < 1.3 ? 0.4 + 0.6 * smoothstep(1, 1.3, asp) : 1
    const shrink = asp < 1 ? 0.8 : 1
    // phones keep only the composition of the track in front (neighbours are not drawn at all)
    const tk = rt.quality.level === 0 ? 0.62 : 1
    for (let i = 0; i < 7; i++) {
      const g = groups.current[i]
      if (!g) continue
      const d = Math.abs(rig.u - i)
      // composition weight: full at its station, gone two stations away
      // the composition belongs to its station: a neighbour is only a ghost of itself, anything further is not rendered at all
      const vis0 = (1 - smoothstep(0.5 * tk, 1.4 * tk, d)) * (on ? 1 : 0) * (1 - recede)
      const focusI = st.selected === i
      const vis = vis0 * (st.selected === null || focusI ? 1 : 0.35)
      const show = vis > 0.01
      if (g.visible !== show) g.visible = show
      if (!show) continue
      const f = smoothstep(1.4, 0.0, d) // 1 exactly at the station
      const items = COMPS[i]
      for (let k = 0; k < items.length; k++) {
        const m = meshes.current[i][k]
        const pl = kit.planes[i][k]
        const ps = state[i][k]
        if (!m) continue
        const it = items[k]
        // seen from the front → full; from behind → a faint ghost
        const dx = camera.position.x - ps.wx, dz = camera.position.z - ps.wz
        const inv = 1 / Math.max(0.001, Math.hypot(dx, dz))
        const facing = 0.1 + 0.9 * smoothstep(-0.05, 0.4, (dx * ps.nx + dz * ps.nz) * inv)
        // reveal: 01 assembles slowly, the rest answer quickly
        const rvT = Math.min(1, f * 1.15 + (i === 0 ? 0 : 0.2))
        ps.rv += (rvT - ps.rv) * Math.min(1, dt * (i === 0 ? 0.9 : red ? 20 : 4.5))
        pl.u.uRv.value = red ? rvT : ps.rv
        pl.u.uObs.value = i === 0 ? 0.55 * (1 - 0.75 * f) : 0
        pl.m.opacity = it.a * vis * facing * (focusI ? 1 : 0.85 + 0.15 * f)
        // behaviours
        const mot = red ? 0 : 1
        let ox = 0, oy = 0, oz = 0, rz = 0, ry = 0
        switch (i) {
          case 1: oy = -(1 - f) * 0.7 * mot + Math.sin(t * 0.5 + k) * 0.03 * mot; break // lifts into place, then hovers
          case 2: break // rigid: no float at all
          case 3: oz = (1 - f) * -0.5 * mot; break // monument settles forward
          case 4: { const loose = f * mot; ox = (k === 0 ? 0.55 : k === 1 ? -0.55 : 0.2) * loose; oy = -Math.sin(t * 0.07 + k) * 0.08 * loose - loose * (k === 1 ? 0.22 : 0); rz = (k === 0 ? -0.04 : 0.05) * loose; break } // loses strict alignment, slowly
          case 5: ry = (k === 0 ? 1 : k === 1 ? -1 : 0) * (1 - f) * 0.55 * mot; oz = k === 0 ? 0.0 : -(1 - f) * 0.4 * mot; break // the masses converge as you arrive
          case 6: oy = (k === 2 ? 0 : (k === 0 ? 1 : -1)) * (1 - f) * 0.5 * mot; break // settles to rest
          default: oy = Math.sin(t * 0.4) * 0.02 * mot
        }
        m.position.set((it.pos[0] + ox) * lat, it.pos[1] + oy, it.pos[2] + oz)
        m.rotation.set(it.rot?.[0] ?? 0, (it.rot?.[1] ?? 0) + ry, (it.rot?.[2] ?? 0) + rz)
        // the monument grows a little as the camera arrives
        const sc = i === 3 ? 0.94 + f * 0.06 : 1
        const aspect = pl.cell.aspect
        m.scale.set(it.h * aspect * sc * shrink, it.h * sc * shrink, 1)
        m.visible = pl.m.opacity > 0.01
      }
    }
  }, -0.3)

  return (
    <group>
      {COMPS.map((items, i) => (
        <group key={i} ref={(r) => { groups.current[i] = r }} position={STATIONS[i].pos} rotation={[0, STATIONS[i].yaw, 0]} visible={false}>
          {items.map((it, k) => (
            <mesh key={k} ref={(r) => { meshes.current[i][k] = r }} geometry={kit.planes[i][k].geo} material={kit.planes[i][k].m} renderOrder={12} frustumCulled />
          ))}
        </group>
      ))}
    </group>
  )
}
