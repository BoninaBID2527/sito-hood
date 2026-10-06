'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GeoBuilder } from '@/lib/geo'
import { streetMat } from './street/materials'

export const CARD_W = 2.15
export const CARD_H = 3.0

/**
 * The seven tracks are seven different physical objects in one installation, all hung from the same truss ring:
 *  01 wheat-paste slab · 02 lightbox · 03 steel-framed plaque · 04 weighted banner · 05 glass pane in clamps ·
 *  06 twin (positive + negative) · 07 lit billboard on a lamp bar.
 * `face` is always the (existing, interactive) card plane at local z = 0.
 */
export interface ObjSpec {
  /** uniform scale — different sizes, never a stretched poster */
  s: number
  /** extra orientation offsets (rad) so the ring is not a row of identical soldiers */
  rx: number
  ry: number
  rz: number
  /** radius multiplier / height offset: places each object at its own depth + height inside the orbit */
  rad: number
  dy: number
  lit: number
  twin?: boolean
}
export const SPECS: ObjSpec[] = [
  { s: 1.0, rx: 0.04, ry: 0.0, rz: 0.02, rad: 1.0, dy: 0.1, lit: 0 },
  { s: 0.94, rx: -0.05, ry: 0.1, rz: -0.025, rad: 1.12, dy: -0.35, lit: 1 },
  { s: 0.86, rx: 0.06, ry: -0.08, rz: 0.03, rad: 0.9, dy: 0.45, lit: 0 },
  { s: 1.14, rx: -0.03, ry: 0.06, rz: -0.02, rad: 1.08, dy: 0.0, lit: 0 },
  { s: 1.04, rx: 0.08, ry: -0.12, rz: 0.015, rad: 0.94, dy: 0.5, lit: 0 },
  { s: 0.9, rx: -0.06, ry: 0.14, rz: -0.03, rad: 1.16, dy: -0.4, lit: 0, twin: true },
  { s: 1.08, rx: 0.05, ry: -0.05, rz: 0.025, rad: 1.0, dy: 0.2, lit: 1 },
]

function hardware(i: number) {
  const metal = new GeoBuilder(), paper = new GeoBuilder(), tape = new GeoBuilder(), body = new GeoBuilder(), lamp = new GeoBuilder(), wood = new GeoBuilder()
  const hw = CARD_W / 2, hh = CARD_H / 2
  const frame = (t: number, z: number, d: number, b: GeoBuilder) => {
    const e = Math.min(0.014, t * 0.3)
    b.rbox(CARD_W + t * 2, t, d, 0, hh + t / 2, z, e)
    b.rbox(CARD_W + t * 2, t, d, 0, -hh - t / 2, z, e)
    b.rbox(t, CARD_H, d, hw + t / 2, 0, z, e)
    b.rbox(t, CARD_H, d, -hw - t / 2, 0, z, e)
  }
  switch (i) {
    case 0: {
      paper.box(CARD_W, CARD_H, 0.035, 0, 0, -0.022)
      // seen from behind it is a pasted-up sheet on a plywood sheet: battens, hanging plates, shackles
      wood.box(CARD_W + 0.06, CARD_H + 0.06, 0.035, 0, 0, -0.058)
      wood.box(CARD_W, 0.1, 0.045, 0, hh * 0.58, -0.098); wood.box(CARD_W, 0.1, 0.045, 0, -hh * 0.58, -0.098); wood.box(0.1, CARD_H, 0.045, 0, 0, -0.098)
      for (const sx of [-1, 1]) { metal.box(0.18, 0.22, 0.02, sx * (hw - 0.22), hh - 0.12, -0.13); metal.cyl(0.018, 0.018, 0.1, sx * (hw - 0.22), hh + 0.0, -0.13, 8, Math.PI / 2) }
      for (const [x, y, r] of [[-hw + 0.1, hh - 0.04, 0.5], [hw - 0.1, hh - 0.06, -0.4], [-hw + 0.06, -hh + 0.1, -0.6], [hw - 0.12, -hh + 0.05, 0.3]] as const) tape.box(0.5, 0.07, 0.01, x, y, 0.012, 0, 0, r)
      break
    }
    case 1: {
      body.rbox(CARD_W + 0.2, CARD_H + 0.2, 0.34, 0, 0, -0.19, 0.03)
      frame(0.07, 0.0, 0.09, metal)
      for (let k = 0; k < 6; k++) metal.box(CARD_W * 0.7, 0.025, 0.02, 0, -hh * 0.6 + k * 0.2, -0.37)
      break
    }
    case 2: {
      frame(0.1, 0.0, 0.14, metal)
      body.box(CARD_W + 0.1, CARD_H + 0.1, 0.05, 0, 0, -0.06)
      for (const [x, y] of [[-hw - 0.05, hh + 0.05], [hw + 0.05, hh + 0.05], [-hw - 0.05, -hh - 0.05], [hw + 0.05, -hh - 0.05]] as const) metal.cyl(0.05, 0.05, 0.04, x, y, 0.08, 10, Math.PI / 2)
      for (const x of [-hw * 0.7, hw * 0.7]) metal.cyl(0.04, 0.04, 0.12, x, hh + 0.14, 0, 8)
      break
    }
    case 3: {
      metal.cyl(0.045, 0.045, CARD_W + 0.35, 0, hh + 0.06, 0.0, 10, 0, 0, Math.PI / 2)
      metal.cyl(0.06, 0.06, CARD_W + 0.2, 0, -hh - 0.04, 0.0, 10, 0, 0, Math.PI / 2)
      for (const s of [-1, 1]) metal.box(0.06, 0.06, 0.06, s * (CARD_W / 2 + 0.17), hh + 0.06, 0)
      paper.box(CARD_W, CARD_H, 0.012, 0, 0, -0.012)
      break
    }
    case 4: {
      for (const [x, y] of [[-hw, hh], [hw, hh], [-hw, -hh], [hw, -hh], [0, hh], [0, -hh]] as const) {
        metal.rbox(0.22, 0.22, 0.09, x, y, 0.05, 0.015)
        metal.cyl(0.035, 0.035, 0.05, x, y, 0.12, 8, Math.PI / 2)
      }
      paper.box(CARD_W + 0.02, CARD_H + 0.02, 0.012, 0, 0, -0.012)
      break
    }
    case 5: {
      body.box(CARD_W, CARD_H, 0.04, 0, 0, -0.025)
      for (const [x, y] of [[-hw + 0.1, hh - 0.1], [hw - 0.1, -hh + 0.1]] as const) { metal.cyl(0.02, 0.02, 0.62, x, y, -0.32, 6, Math.PI / 2); metal.cyl(0.05, 0.05, 0.02, x, y, 0.03, 8, Math.PI / 2) }
      break
    }
    case 6: {
      body.rbox(CARD_W + 0.1, CARD_H + 0.1, 0.16, 0, 0, -0.1, 0.02)
      frame(0.05, 0.0, 0.08, metal)
      metal.box(CARD_W + 0.2, 0.05, 0.05, 0, hh + 0.22, 0.34)
      for (const s of [-1, 0, 1]) { metal.box(0.04, 0.04, 0.4, s * CARD_W * 0.34, hh + 0.12, 0.17); lamp.add(new THREE.SphereGeometry(0.07, 8, 6), s * CARD_W * 0.34, hh + 0.2, 0.38) }
      break
    }
  }
  return { metal, paper, tape, body, lamp, wood }
}

export function TrackObject({ i, faceGeo, faceMat, mats, onFace, twinMat, glassMat }: {
  i: number
  faceGeo: THREE.BufferGeometry
  faceMat: THREE.Material
  mats: ReturnType<typeof useObjectMats>
  onFace: Record<string, (e: any) => void>
  twinMat: THREE.Material | null
  glassMat: THREE.Material
}) {
  const built = useMemo(() => {
    const h = hardware(i)
    const mk = (b: GeoBuilder) => (b.empty ? null : b.build())
    return { metal: mk(h.metal), paper: mk(h.paper), tape: mk(h.tape), body: mk(h.body), lamp: mk(h.lamp), wood: mk(h.wood) }
  }, [i])
  useEffect(() => () => Object.values(built).forEach((g) => g?.dispose()), [built])
  return (
    <group>
      <mesh geometry={faceGeo} material={faceMat} castShadow {...onFace} />
      {built.metal && <mesh geometry={built.metal} castShadow material={mats.metal} />}
      {built.paper && <mesh geometry={built.paper} castShadow material={mats.paper} />}
      {built.tape && <mesh geometry={built.tape} castShadow material={mats.tape} />}
      {built.body && <mesh geometry={built.body} castShadow material={i === 1 ? mats.lightbox : mats.body} />}
      {built.lamp && <mesh geometry={built.lamp} material={mats.lamp} />}
      {built.wood && <mesh geometry={built.wood} castShadow material={mats.wood} />}
      {i === 4 && <mesh geometry={mats.plane} material={glassMat} position={[0, 0, 0.07]} scale={[CARD_W + 0.1, CARD_H + 0.1, 1]} renderOrder={21} />}
      {i === 5 && twinMat && <mesh geometry={faceGeo} material={twinMat} position={[0.5, -0.32, -0.55]} scale={0.93} rotation={[0, 0.0, 0.03]} />}
    </group>
  )
}

export function useObjectMats() {
  const m = useMemo(
    () => ({
      metal: streetMat({ color: '#1d1e22', roughness: 0.42, metalness: 0.85, aoBase: 0.9, macro: 0.4 }),
      body: streetMat({ color: '#15161a', roughness: 0.6, metalness: 0.4, aoBase: 0.9, macro: 0.4 }),
      paper: streetMat({ color: '#4f493f', roughness: 0.96, aoBase: 0.9, macro: 0.9 }),
      tape: new THREE.MeshStandardMaterial({ color: '#8f8467', roughness: 0.85, transparent: true, opacity: 0.8 }),
      lightbox: streetMat({ color: '#15161a', roughness: 0.55, metalness: 0.6, aoBase: 0.9, macro: 0.9, emissive: new THREE.Color('#ffc886'), emissiveIntensity: 0.0 }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 2.2) }),
      wood: streetMat({ color: '#6a5539', roughness: 0.93, aoBase: 0.85, macro: 1.0, seed: 4.4 }),
      plane: new THREE.PlaneGeometry(1, 1),
    }),
    [],
  )
  useEffect(() => () => { Object.values(m).forEach((x: any) => x.dispose?.()) }, [m])
  return m
}
