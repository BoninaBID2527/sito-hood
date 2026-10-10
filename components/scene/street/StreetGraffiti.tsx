'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rng } from '@/lib/math'
import { atlasMaterial, buildAtlasMesh, shadowTexture, type Placement } from './atlasDecals'
import { wallX } from './layout'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)
const OFF = 0.003

type Layer = 'spray' | 'paper' | 'over'
interface Item { layer: Layer; id: string; side: -1 | 1; z: number; y: number; w: number; rot?: number; zi?: number; tint?: number; bend?: number; curl?: number }
const L = -1 as const, R = 1 as const

/**
 * THE STREET'S HANDWRITING — authored, not scattered.
 * Many hands over many years: a few enormous blockbusters, rare wildstyle, sparing throw-ups, a crowd of different tags,
 * stencils, notes for people who look closely, and wheatpaste that covers some of it. Every piece has its own history.
 */
// V3.8/11: full rotated footprints clear openings, segment steps, piers and installed services.
// Paper clusters and their overpaint move together; reserve the TRACKS/ROOF/OneWay sign bays.
// See qa/v38/cleanup11 for the authored coordinates and support audit.
const LAYOUT: Item[] = [
  /* ── blockbusters ── */
  { layer: 'spray', id: 'blk_hood', side: L, z: 7.7, y: 2.3, w: 1.98 },
  { layer: 'spray', id: 'blk_alterco', side: R, z: -17, y: 0.9, w: 4.2, rot: 0.01 },
  { layer: 'spray', id: 'blk_hood2', side: R, z: -86.8, y: 2.2, w: 5.16},
  { layer: 'spray', id: 'blk_alterco2', side: L, z: -92.8, y: 2.2, w: 4.92},
  { layer: 'spray', id: 'blk_dino', side: L, z: -83.6, y: 2.2, w: 3.5},
  /* ── wildstyle (rare) ── */
  { layer: 'spray', id: 'wild_kold', side: L, z: -29.2, y: 1.4, w: 3.5 },
  { layer: 'spray', id: 'wild_skrt', side: R, z: -64.6, y: 1.1, w: 2.55 },
  { layer: 'spray', id: 'wild_vert', side: R, z: -106.4, y: 2.4, w: 3.705},
  /* ── throw-ups ── */
  { layer: 'spray', id: 'thr_nyx', side: R, z: -3.3, y: 1.5, w: 2.2 },
  { layer: 'spray', id: 'thr_moss', side: L, z: -11.8, y: 1.4, w: 2.4 },
  { layer: 'spray', id: 'thr_raw', side: L, z: -32.4, y: 1.3, w: 2.5 },
  { layer: 'spray', id: 'thr_jade', side: R, z: -55, y: 1.7, w: 2.3 },
  /* ── hand tags (many writers) ── */
  { layer: 'spray', id: 'hand_kold', side: L, z: 12.8, y: 0.9, w: 1.1, rot: 0.05 },
  { layer: 'spray', id: 'hand_nyx', side: L, z: 4.2, y: 2.2, w: 1.3 },
  { layer: 'spray', id: 'hand_ink', side: L, z: -1.2, y: 0.9, w: 0.95 },
  { layer: 'spray', id: 'hand_echo', side: L, z: -23.1, y: 1.4, w: 1.5 },
  { layer: 'spray', id: 'hand_alt', side: L, z: -41.2, y: 0.9, w: 1.3 },
  { layer: 'spray', id: 'hand_moss', side: L, z: -47.5, y: 0.8, w: 1.3 },
  { layer: 'spray', id: 'hand_oka', side: L, z: -55.6, y: 1.6, w: 1.5 },
  { layer: 'spray', id: 'hand_skrt', side: R, z: 13.6, y: 1.2, w: 1.4 },
  { layer: 'spray', id: 'hand_raw', side: R, z: -9.2, y: 1.6, w: 1.25 },
  { layer: 'spray', id: 'hand_jade', side: R, z: -26, y: 1.8, w: 1.2 },
  { layer: 'spray', id: 'hand_vert', side: R, z: -43, y: 1.05, w: 1.2 },
  { layer: 'spray', id: 'hand_zed', side: R, z: -49.8, y: 2.2, w: 1.2 },
  { layer: 'spray', id: 'hand_hd', side: R, z: -0.4, y: 2.1, w: 0.95 },
  /* ── stencils ── */
  { layer: 'spray', id: 'st_hood_row', side: L, z: -4.6, y: 0.6, w: 2.28 },
  { layer: 'spray', id: 'st_alterco_row', side: R, z: -7.8, y: 0.6, w: 2.6 },
  { layer: 'spray', id: 'st_barcode', side: R, z: 5, y: 0.9, w: 0.7 },
  { layer: 'spray', id: 'st_arrow', side: L, z: -25.5, y: 0.75, w: 0.8 },
  { layer: 'spray', id: 'st_coords', side: L, z: -31.5, y: 1.1, w: 1.5 },
  { layer: 'spray', id: 'st_cross', side: R, z: -30.6, y: 1, w: 0.85 },
  { layer: 'spray', id: 'st_hd', side: R, z: -46, y: 1.3, w: 0.8 },
  { layer: 'spray', id: 'st_eye', side: L, z: -62, y: 1.1, w: 0.75 },
  { layer: 'spray', id: 'st_hour', side: L, z: -63.5, y: 1.55, w: 0.65 },
  /* ── notes ── */
  { layer: 'spray', id: 'note_far', side: L, z: -15.4, y: 1.2, w: 1.4 },
  { layer: 'spray', id: 'note_back', side: R, z: -6, y: 1.2, w: 1.3 },
  { layer: 'spray', id: 'note_hd', side: R, z: -19, y: 0.5, w: 1.2 },
  { layer: 'spray', id: 'note_sette', side: L, z: -33.4, y: 0.75, w: 1.2 },
  { layer: 'spray', id: 'note_ear', side: L, z: -35.7, y: 0.5, w: 0.9 },
  { layer: 'spray', id: 'note_water', side: R, z: -43, y: 0.6, w: 1.45 },
  { layer: 'spray', id: 'note_other', side: L, z: -54.6, y: 0.95, w: 1.3 },
  { layer: 'spray', id: 'note_roof', side: R, z: -61.8, y: 1.9, w: 1.425 },
  /* ── wheatpaste: clusters with overlap, scraps and later tags on top ── */
  { layer: 'paper', id: 'tp_6', side: L, z: 16.4, y: 1.8, w: 0.92, rot: -0.04, zi: 1, bend: 0.012, curl: 0.05 },
  { layer: 'paper', id: 'fr_serif', side: L, z: 15.9, y: 1.25, w: 0.7, rot: 0.1, zi: 2, bend: 0.01, curl: 0.03 },
  { layer: 'paper', id: 'tp_1', side: R, z: 11.6, y: 1.8, w: 0.95, rot: 0.03, zi: 1, bend: 0.014, curl: 0.04 },
  { layer: 'paper', id: 'tp_4', side: R, z: 10.9, y: 1.55, w: 0.9, rot: -0.07, zi: 2, bend: 0.012, curl: 0.06 },
  { layer: 'paper', id: 'stk_hd', side: R, z: 9.6, y: 1, w: 0.2, rot: 0.2, zi: 3 },
  { layer: 'paper', id: 'tp_2', side: L, z: -4.4, y: 1.8, w: 0.98, rot: 0.04, zi: 1, bend: 0.012, curl: 0.04 },
  { layer: 'paper', id: 'fl_1', side: L, z: -5.5, y: 1.4, w: 0.62, rot: -0.1, zi: 2, bend: 0.01, curl: 0.05 },
  { layer: 'paper', id: 'tp_5', side: R, z: -19, y: 2, w: 0.712, rot: -0.03, zi: 1, bend: 0.013 },
  { layer: 'paper', id: 'fr_mono', side: R, z: -19.6, y: 1.625, w: 0.6, rot: 0.06, zi: 2, bend: 0.01, curl: 0.04 },
  { layer: 'paper', id: 'stk_alt', side: R, z: -19.975, y: 1.212, w: 0.165, rot: -0.2, zi: 3 },
  { layer: 'paper', id: 'tp_7', side: L, z: -25.4, y: 1.9, w: 0.864, rot: 0.02, zi: 1, bend: 0.012, curl: 0.04 },
  { layer: 'paper', id: 'tp_3', side: L, z: -26.03, y: 1.54, w: 0.81, rot: -0.09, zi: 2, bend: 0.012, curl: 0.06 },
  { layer: 'paper', id: 'fr_04', side: L, z: -23.6, y: 2.2, w: 0.5, rot: 0.08, zi: 1, bend: 0.008, curl: 0.04 },
  { layer: 'paper', id: 'fl_3', side: R, z: -37.6, y: 1.7, w: 0.62, rot: 0.05, zi: 1, bend: 0.01, curl: 0.04 },
  { layer: 'paper', id: 'tp_2', side: R, z: -38.3, y: 1.9, w: 0.9, rot: -0.04, zi: 0, bend: 0.012, tint: 0.85 },
  { layer: 'paper', id: 'tp_hood', side: L, z: -48.8, y: 1.8, w: 0.95, rot: 0.03, zi: 1, bend: 0.013, curl: 0.04 },
  { layer: 'paper', id: 'fr_anton', side: L, z: -49.5, y: 1.05, w: 0.7, rot: -0.08, zi: 2, bend: 0.01 },
  { layer: 'paper', id: 'fl_2', side: R, z: -47.8, y: 1.6, w: 0.6, rot: 0.04, zi: 1, bend: 0.01, curl: 0.04 },
  { layer: 'paper', id: 'tp_5', side: R, z: -48.6, y: 1.8, w: 0.9, rot: -0.06, zi: 0, bend: 0.012, tint: 0.8 },
  { layer: 'paper', id: 'stk_eye', side: R, z: -49.2, y: 0.8, w: 0.2, rot: 0.1, zi: 3 },
  { layer: 'paper', id: 'tp_3', side: L, z: -60.6, y: 1.8, w: 0.94, rot: 0.05, zi: 1, bend: 0.012, curl: 0.05, tint: 0.9 },
  { layer: 'paper', id: 'fr_xerox', side: L, z: -61.2, y: 1.2, w: 0.7, rot: -0.06, zi: 2, bend: 0.01 },
  { layer: 'paper', id: 'stk_seven', side: L, z: -1.6, y: 1.8, w: 0.2, rot: 0.1, zi: 3 },
  { layer: 'paper', id: 'stk_hd2', side: L, z: 8.4, y: 1.4, w: 0.18, rot: -0.2, zi: 3 },
  { layer: 'paper', id: 'tp_4', side: L, z: -71.8, y: 1.8, w: 1, rot: 0.03, zi: 1, bend: 0.014, curl: 0.05, tint: 0.85 },
  { layer: 'paper', id: 'tp_7', side: R, z: -70, y: 1.8, w: 1, rot: -0.03, zi: 1, bend: 0.014, curl: 0.05 },
  /* ── later tags on top of posters (spray over paper) ── */
  { layer: 'over', id: 'hand_echo', side: R, z: 11.2, y: 1.35, w: 0.9, rot: -0.2, tint: 0.95 },
  { layer: 'over', id: 'hand_hd', side: L, z: -4.9, y: 2, w: 0.8, rot: 0.15, tint: 0.9 },
  { layer: 'over', id: 'hand_kold', side: L, z: -25.76, y: 1.72, w: 0.855, rot: 0.2 },
  { layer: 'over', id: 'hand_nyx', side: R, z: -38.4, y: 2.05, w: 0.9, rot: -0.1 },
  { layer: 'over', id: 'note_ear', side: L, z: -49.1, y: 0.8, w: 0.7, rot: 0.1 },
]

export function StreetGraffiti() {
  const kit = useMemo(() => {
    const G = A.graf
    const sprayMat = atlasMaterial(G.sprayTex, { seed: 3 })
    const paperMat = atlasMaterial(G.paperTex, { paper: true, seed: 7 })
    const shadowTex = shadowTexture()
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: '#000', opacity: 0.42, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    const r = rng(77)
    const place = (it: Item, idx: number): Placement | null => {
      const cell = (it.layer === 'paper' ? G.pap : G.spr)[it.id]
      if (!cell) return null
      const zi = it.zi ?? 0
      const off = it.layer === 'over' ? 0.020 : OFF + (it.layer === 'paper' ? 0.004 + 0.004 * zi : 0)
      const h = it.w / cell.aspect
      return {
        cell, pos: [wallX(it.side, it.z) - it.side * off, it.y, it.z], ry: rotFor(it.side), rz: (it.rot ?? 0) + (it.layer === 'spray' ? (r() - 0.5) * 0.03 : 0), w: it.w,
        tint: it.tint ?? 0.88 + r() * 0.2, bend: it.bend, curl: it.curl, seed: idx + 1,
        // keep the lowest edge off the ground
        ...(it.y - h / 2 < 0.05 ? { pos: [wallX(it.side, it.z) - it.side * off, h / 2 + 0.05, it.z] as [number, number, number] } : {}),
      }
    }
    const by = (layer: Layer) => LAYOUT.map((it, i) => (it.layer === layer ? place(it, i) : null)).filter(Boolean) as Placement[]
    const spray = by('spray'), paper = by('paper').sort((a, b) => a.pos[0] === b.pos[0] ? 0 : 0), over = by('over')
    // paper: stack order = zi (lower first) so that overlap reads as later layers on top
    const paperSorted = LAYOUT.filter((i) => i.layer === 'paper').map((it, i) => ({ it, p: place(it, 100 + i)! })).sort((a, b) => (a.it.zi ?? 0) - (b.it.zi ?? 0)).map((x) => x.p)
    void paper
    const shadows: Placement[] = paperSorted.map((p) => ({
      ...p, cell: { ...p.cell, uv: [0, 0, 1, 1] }, w: p.w * 1.1, pos: [p.pos[0] + (p.pos[0] < 0 ? 0.002 : -0.002), p.pos[1] - 0.012, p.pos[2]], tint: 1, bend: 0, curl: 0,
    }))
    const sprayBatch = buildAtlasMesh(spray, sprayMat, { order: 1 })
    const shadowGeo = new THREE.PlaneGeometry(1, 1)
    const shadowIm = new THREE.InstancedMesh(shadowGeo, shadowMat, shadows.length)
    {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3()
      shadows.forEach((s, i) => {
        const h = s.w / (paperSorted[i].cell.aspect)
        p.set(...s.pos); q.setFromEuler(eu.set(0, s.ry, s.rz ?? 0, 'YXZ')); sc.set(s.w, h * 1.1, 1)
        shadowIm.setMatrixAt(i, m4.compose(p, q, sc))
      })
      shadowIm.frustumCulled = false
      shadowIm.renderOrder = 2
    }
    const paperBatch = buildAtlasMesh(paperSorted, paperMat, { segs: 6, order: 3 })
    const overBatch = buildAtlasMesh(over, sprayMat, { order: 4 })
    return { sprayMat, paperMat, shadowTex, shadowMat, sprayBatch, shadowIm, shadowGeo, paperBatch, overBatch }
  }, [])

  useEffect(
    () => () => {
      kit.sprayMat.dispose(); kit.paperMat.dispose(); kit.shadowTex.dispose(); kit.shadowMat.dispose()
      kit.sprayBatch.geo.dispose(); kit.sprayBatch.mesh.dispose(); kit.paperBatch.geo.dispose(); kit.paperBatch.mesh.dispose(); kit.overBatch.geo.dispose(); kit.overBatch.mesh.dispose()
      kit.shadowGeo.dispose(); kit.shadowIm.dispose()
    },
    [kit],
  )

  return (
    <group>
      <primitive object={kit.sprayBatch.mesh} />
      <primitive object={kit.shadowIm} />
      <primitive object={kit.paperBatch.mesh} />
      <primitive object={kit.overBatch.mesh} />
    </group>
  )
}
