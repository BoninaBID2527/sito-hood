'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { DOOR } from '@/lib/room'
import { GeoBuilder, worldUV } from '@/lib/geo'
import { allWindows, segAt, streetLevelItems } from '../street/layout'
import { wallWithOpenings, type Hole } from '../street/facadeBuild'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** The actual opposite alley segment, translated into the ROOM pocket.
 * Only the section visible through the doorway is copied. Shared source textures
 * stay owned by A; all local meshes/materials are disposed with the room.
 * Static diffuse dusk illumination avoids importing the entire street renderer. */
export function ExteriorReturn() {
  const kit = useMemo(() => {
    const segment = segAt(1, DOOR.z), level = streetLevelItems()
    const windows = allWindows().filter(w => !w.face && w.side === 1 && w.z < segment.z0 && w.z > segment.z1 && w.y < 9)
    const doors = level.doors.flat().filter(d => d.side === 1 && d.z < segment.z0 && d.z > segment.z1)
    const shutters = level.shutters.flat().filter(d => d.side === 1 && d.z < segment.z0 && d.z > segment.z1)
    const holes: Hole[] = windows.map(w => ({ z0: w.z + w.w / 2, z1: w.z - w.w / 2, y0: w.y - 1.55 * w.h / 2, y1: w.y + 1.55 * w.h / 2, depth: .28 }))
    for (const d of doors) holes.push({ z0: d.z + .575, z1: d.z - .575, y0: 0, y1: 2.355, depth: .24 })
    for (const d of shutters) holes.push({ z0: d.z + 1.45, z1: d.z - 1.45, y0: 0, y1: 2.8, depth: .2 })
    const transform = (g: THREE.BufferGeometry) => {
      g.rotateY(-Math.PI / 2); g.translate(DORIGIN.x, 0, DORIGIN.z); return g
    }
    const meshes: { geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial }[] = []
    const mats = new Map<string, THREE.MeshBasicMaterial>()
    const mat = (key: string, map: THREE.Texture, tint = '#aab1c0', vertexColors = false) => {
      if (!mats.has(key)) mats.set(key, new THREE.MeshBasicMaterial({ map, color: new THREE.Color(tint).multiplyScalar(.55), vertexColors, fog: false }))
      return mats.get(key)!
    }
    meshes.push({ geo: transform(wallWithOpenings({ side: 1, x: segment.hw, zNear: segment.z0, zFar: segment.z1, h: 10, holes })), mat: mat('wall', A.brick[segment.kind].map, segment.tint, true) })
    const trim = new GeoBuilder().box(.16, .24, segment.z0 - segment.z1, segment.hw - .04, 4.38, (segment.z0 + segment.z1) / 2)
    for (const z of [segment.z0 - 2.9, segment.z0 - 8.9, segment.z0 - 14.9]) {
      if (!holes.some(h => h.y0 === 0 && z < h.z0 + .2 && z > h.z1 - .2)) trim.box(.18, 4.3, .25, segment.hw - .04, 2.15, z)
    }
    const tg = trim.build(); worldUV(tg, 1.6)
    meshes.push({ geo: transform(tg), mat: mat('stone', A.sidewalk, '#8c8980') })
    const plane = (w: number, h: number, x: number, y: number, z: number, material: THREE.MeshBasicMaterial) => {
      const g = new THREE.PlaneGeometry(w, h); g.rotateY(-Math.PI / 2); g.translate(x, y, z)
      meshes.push({ geo: transform(g), mat: material })
    }
    for (const w of windows) plane(w.w, w.h * 1.55, segment.hw + .28, w.y, w.z, mat(`window-${w.variant}`, A.windows[w.variant]))
    for (const group of level.doors) for (const d of group.filter(d => doors.includes(d))) plane(1.15, 2.355, segment.hw + .24, 1.1775, d.z, mat(`door-${level.doors.indexOf(group)}`, A.doors[level.doors.indexOf(group)]))
    for (const group of level.shutters) for (const d of group.filter(d => shutters.includes(d))) plane(2.9, 2.8, segment.hw + .2, 1.4, d.z, mat(`shutter-${level.shutters.indexOf(group)}`, A.shutters[level.shutters.indexOf(group)]))
    const floor = new THREE.PlaneGeometry(segment.hw - DOOR.x, 16)
    floor.rotateX(-Math.PI / 2); floor.translate((segment.hw + DOOR.x) / 2, -.012, DOOR.z)
    worldUV(floor, 2.4)
    meshes.push({ geo: transform(floor), mat: mat('asphalt', A.asphalt, '#8a929e') })
    const kerb = new GeoBuilder().box(.24, .17, 16, segment.hw - .35, .075, DOOR.z).box(.5, .05, 16, segment.hw - .05, .145, DOOR.z).build()
    worldUV(kerb, 1.6)
    meshes.push({ geo: transform(kerb), mat: mat('stone', A.sidewalk, '#8c8980') })
    // One draw per shared surface, including all windows of the same variant.
    const batches = new Map<THREE.MeshBasicMaterial, THREE.BufferGeometry[]>()
    for (const m of meshes) {
      if (!m.geo.index) m.geo.setIndex(Array.from({ length: m.geo.attributes.position.count }, (_, i) => i))
      if (!batches.has(m.mat)) batches.set(m.mat, [])
      batches.get(m.mat)!.push(m.geo)
    }
    const merged = [...batches].map(([mat, geometries]) => {
      const geo = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)!
      if (geometries.length > 1) geometries.forEach(g => g.dispose())
      return { mat, geo }
    })
    return { meshes: merged, mats }
  }, [])
  useEffect(() => () => { kit.meshes.forEach(m => m.geo.dispose()); kit.mats.forEach(m => m.dispose()) }, [kit])
  return <group>{kit.meshes.map((m, i) => <mesh key={i} geometry={m.geo} material={m.mat} />)}</group>
}

const DORIGIN = { x: DOOR.z, z: -DOOR.x }
