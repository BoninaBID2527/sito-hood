'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rng } from '@/lib/math'
import { tileUV } from '@/lib/geo'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'
import { streetMat } from './materials'
import { PLAZA, SEGS, segAt, windowsFor, type BrickKind, type WinInst } from './layout'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)

/** Brick / plaster / concrete walls, wall returns, cornices. */
export function Walls() {
  const { mats, items } = useMemo(() => {
    const mats: Record<string, THREE.MeshStandardMaterial> = {}
    const kinds: BrickKind[] = ['red', 'dark', 'weathered', 'plaster', 'concrete']
    for (const k of kinds) {
      const set = A.brick[k]
      mats[k] = streetMat({ map: set.map, roughness: 0.92, color: '#ffffff', side: THREE.FrontSide, aoBase: 0.4 })
    }
    const tintMat = (k: BrickKind, tint: string) => {
      const key = `${k}-${tint}`
      if (!mats[key]) {
        const m = mats[k].clone()
        m.color = new THREE.Color(tint)
        mats[key] = streetMat({ map: A.brick[k].map, roughness: 0.92, color: tint, aoBase: 0.4 })
        void m
      }
      return mats[key]
    }
    const items: { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number]; rot: [number, number, number] }[] = []
    const trim = streetMat({ color: '#3b3733', roughness: 0.9, aoBase: 0.5 })
    mats.trim = trim

    for (const s of SEGS) {
      const len = s.z0 - s.z1
      const g = new THREE.PlaneGeometry(len, s.h, Math.max(2, Math.round(len / 2)), Math.max(2, Math.round(s.h / 3)))
      tileUV(g, len, s.h, 2.4)
      items.push({ geo: g, mat: tintMat(s.kind, s.tint), pos: [s.side * s.hw, s.h / 2, (s.z0 + s.z1) / 2], rot: [0, rotFor(s.side), 0] })
      // cornice
      const c = new THREE.BoxGeometry(0.55, 0.7, len + 0.2)
      items.push({ geo: c, mat: trim, pos: [s.side * (s.hw - 0.2), s.h - 0.1, (s.z0 + s.z1) / 2], rot: [0, 0, 0] })
      // string course (a shadow line a few floors up, adds relief)
      const sc = new THREE.BoxGeometry(0.28, 0.35, len)
      items.push({ geo: sc, mat: trim, pos: [s.side * (s.hw - 0.1), 4.4, (s.z0 + s.z1) / 2], rot: [0, 0, 0] })
    }
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
        items.push({ geo: g, mat: tintMat(far.kind, far.tint), pos: [x, h / 2, near.z1], rot: [0, protrudes ? 0 : Math.PI, 0] })
      }
    }
    // end of alley → plaza walls + connecting faces
    for (const side of [-1, 1] as const) {
      const last = SEGS.filter((s) => s.side === side).sort((a, b) => a.z1 - b.z1)[0]
      const len = PLAZA.z0 - PLAZA.z1
      const g = new THREE.PlaneGeometry(len, 20, 12, 8)
      tileUV(g, len, 20, 2.4)
      items.push({ geo: g, mat: mats[side === -1 ? 'dark' : 'weathered'], pos: [side * PLAZA.hw, 10, (PLAZA.z0 + PLAZA.z1) / 2], rot: [0, rotFor(side), 0] })
      const dx = PLAZA.hw - last.hw
      const g2 = new THREE.PlaneGeometry(dx, last.h)
      tileUV(g2, dx, last.h, 2.4)
      items.push({ geo: g2, mat: tintMat(last.kind, last.tint), pos: [side * (last.hw + dx / 2), last.h / 2, last.z1], rot: [0, 0, 0] })
      const cr = new THREE.BoxGeometry(0.55, 0.7, len)
      items.push({ geo: cr, mat: trim, pos: [side * (PLAZA.hw - 0.2), 19.9, (PLAZA.z0 + PLAZA.z1) / 2], rot: [0, 0, 0] })
    }
    // back of the alley (behind the camera start) so pointer parallax never reveals the void
    const back = new THREE.PlaneGeometry(8, 24)
    tileUV(back, 8, 24, 2.4)
    items.push({ geo: back, mat: mats.dark, pos: [0, 12, 30], rot: [0, Math.PI, 0] })
    return { mats, items }
  }, [])

  // merge every wall piece that shares a material into one geometry (≈50 draw calls → ≈10)
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
    return [...by.entries()].map(([mat, list]) => ({ mat, geo: mergeGeometries(list, false)! }))
  }, [items])

  useEffect(
    () => () => {
      items.forEach((i) => i.geo.dispose())
      merged.forEach((m) => m.geo.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [items, mats, merged],
  )

  return (
    <group>
      {merged.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} />
      ))}
    </group>
  )
}

/** Windows, sills and lintels — instanced. */
export function Windows({ skip = {} as Record<string, number[]> }) {
  const data = useMemo(() => {
    const all: WinInst[] = []
    SEGS.forEach((s, i) => all.push(...windowsFor(s, 1000 + i * 7, skip[`${s.side}`] ?? [])))
    // plaza walls
    for (const side of [-1, 1] as const) {
      const r = rng(side === -1 ? 91 : 92)
      for (let z = PLAZA.z0 - 2; z > PLAZA.z1 + 1; z -= 3.4) for (let k = 0; k < 5; k++) {
        const y = 4.6 + k * 3.4
        if (r() < 0.1) continue
        const roll = r()
        all.push({ side, x: side * PLAZA.hw, y, z, variant: roll < 0.2 ? 'warm' : roll < 0.27 ? 'cool' : roll < 0.6 ? 'blind' : 'dark', w: 1, h: 1.55 })
      }
    }
    return all
  }, [skip])

  const built = useMemo(() => {
    const variants = ['dark', 'warm', 'cool', 'blind'] as const
    const plane = new THREE.PlaneGeometry(1.0, 1.55)
    const sillGeo = new THREE.BoxGeometry(1.35, 0.12, 0.3)
    const lintelGeo = new THREE.BoxGeometry(1.25, 0.16, 0.22)
    const concrete = streetMat({ color: '#6f6a62', roughness: 0.95, aoBase: 0.6 })
    const meshes: THREE.InstancedMesh[] = []
    const mats: THREE.MeshStandardMaterial[] = []
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
    const eu = new THREE.Euler()
    const sills: THREE.Matrix4[] = []
    const lintels: THREE.Matrix4[] = []

    for (const v of variants) {
      const list = data.filter((d) => d.variant === v)
      if (!list.length) continue
      const tex = A.windows[v]
      const lit = v !== 'dark'
      const mat = new THREE.MeshStandardMaterial({
        map: tex, roughness: v === 'dark' ? 0.25 : 0.7, metalness: v === 'dark' ? 0.3 : 0,
        emissive: lit ? new THREE.Color('#ffffff') : new THREE.Color('#000000'), emissiveMap: lit ? tex : null, emissiveIntensity: 0.4,
      })
      mat.userData.variant = v
      const im = new THREE.InstancedMesh(plane, mat, list.length)
      list.forEach((d, i) => {
        const inward = -d.side
        p.set(d.x + inward * 0.05, d.y, d.z)
        q.setFromEuler(eu.set(0, rotFor(d.side), 0))
        m4.compose(p, q, s)
        im.setMatrixAt(i, m4)
        // sill + lintel (shared across variants)
        p.set(d.x + inward * 0.14, d.y - 0.86, d.z)
        sills.push(new THREE.Matrix4().compose(p.clone(), q.clone(), s.clone().setScalar(1)))
        p.set(d.x + inward * 0.1, d.y + 0.88, d.z)
        lintels.push(new THREE.Matrix4().compose(p.clone(), q.clone(), s.clone()))
      })
      im.instanceMatrix.needsUpdate = true
      im.frustumCulled = false
      meshes.push(im)
      mats.push(mat)
    }
    const mk = (geo: THREE.BufferGeometry, list: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(geo, concrete, list.length)
      list.forEach((m, i) => im.setMatrixAt(i, m))
      im.instanceMatrix.needsUpdate = true
      im.frustumCulled = false
      return im
    }
    // sills/lintels are oriented with the wall: box depth axis = local z → needs same Y rotation, already in q.
    meshes.push(mk(sillGeo, sills), mk(lintelGeo, lintels))
    return { meshes, mats, geos: [plane, sillGeo, lintelGeo], concrete }
  }, [data])

  useFrame(() => {
    const w = palette.windows
    for (const m of built.mats) {
      const v = m.userData.variant as string
      m.emissiveIntensity = v === 'warm' ? 0.12 + w * 2.1 : v === 'cool' ? 0.1 + w * 1.5 : v === 'blind' ? 0.05 + w * 0.55 : 0
    }
  })

  useEffect(
    () => () => {
      built.meshes.forEach((m) => m.dispose())
      built.mats.forEach((m) => m.dispose())
      built.geos.forEach((g) => g.dispose())
      built.concrete.dispose()
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

/** Roller shutters and metal doors at street level (instanced per texture variant). */
export function StreetLevel({ skip = [] as { side: -1 | 1; z: number; r: number }[] }) {
  const built = useMemo(() => {
    const r = rng(404)
    type T = { side: -1 | 1; z: number }
    const shutters: T[][] = [[], [], []]
    const doors: T[][] = [[], [], []]
    for (const s of SEGS) {
      let z = s.z0 - 2.2
      while (z > s.z1 + 2) {
        const blocked = skip.some((k) => k.side === s.side && Math.abs(k.z - z) < k.r)
        const roll = r()
        if (!blocked) {
          if (roll < 0.34) shutters[r.int(0, 2)].push({ side: s.side, z })
          else if (roll < 0.62) doors[r.int(0, 2)].push({ side: s.side, z })
        }
        z -= r.range(3.6, 6.4)
      }
    }
    const meshes: THREE.InstancedMesh[] = []
    const disposables: { dispose(): void }[] = []
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), eu = new THREE.Euler()
    const make = (list: T[], geo: THREE.BufferGeometry, tex: THREE.Texture, y: number, off: number) => {
      if (!list.length) return
      const mat = streetMat({ map: tex, roughness: 0.55, metalness: 0.55, color: '#ffffff', aoBase: 0.55 })
      const im = new THREE.InstancedMesh(geo, mat, list.length)
      list.forEach((t, i) => {
        const x = segAt(t.side, t.z).hw
        p.set(t.side * x - t.side * off, y, t.z)
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
    shutters.forEach((l, i) => make(l, shGeo, A.shutters[i], 1.4, 0.04))
    doors.forEach((l, i) => make(l, dGeo, A.doors[i], 1.18, 0.05))
    // housings / frames
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
    addFrames(shutters, fGeo, 2.9, 0.15)
    addFrames(doors, dfGeo, 2.42, 0.12)
    return { meshes, disposables }
  }, [skip])

  useEffect(() => () => built.disposables.forEach((d) => d.dispose()), [built])
  return (
    <group>
      {built.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}
