'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Distance + frustum culling for long, merged street geometry.
 * The alley is ~140 m long and most of its detail is merged into a handful of meshes — three can only cull a whole mesh, and from the
 * plaza (looking back down the alley) all of them are "in view" although most are 60–130 m away, in fog. Splitting them into z-chunks
 * lets frustum culling AND a single distance test (one callback for everything) drop what cannot be seen.
 */
interface Entry { obj: THREE.Object3D; c: THREE.Vector3; r: number; range: number }
const reg = new Set<Entry>()

export function registerCull(obj: THREE.Object3D, c: [number, number, number], r: number, range = 62) {
  const e: Entry = { obj, c: new THREE.Vector3(...c), r, range }
  reg.add(e)
  return () => {
    reg.delete(e)
  }
}

/** one useFrame for every registered chunk */
export function ChunkCuller() {
  useFrame(({ camera }) => {
    const p = camera.position
    for (const e of reg) {
      const v = p.distanceTo(e.c) - e.r < e.range
      if (e.obj.visible !== v) e.obj.visible = v
    }
  }, -1.4)
  return null
}

/** split a (merged) geometry into z-slabs by triangle centroid; every attribute is carried over */
export function chunkGeometry(src: THREE.BufferGeometry, edges: number[]) {
  const geo = src.index ? src.toNonIndexed() : src
  const pos = geo.attributes.position as THREE.BufferAttribute
  const triCount = pos.count / 3
  const bucket: number[][] = Array.from({ length: edges.length + 1 }, () => [])
  for (let t = 0; t < triCount; t++) {
    const z = (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3
    let b = 0
    while (b < edges.length && z < edges[b]) b++
    bucket[b].push(t)
  }
  const out: { geo: THREE.BufferGeometry; c: THREE.Vector3; r: number }[] = []
  for (const tris of bucket) {
    if (!tris.length) continue
    const g = new THREE.BufferGeometry()
    for (const name of Object.keys(geo.attributes)) {
      const a = geo.attributes[name] as THREE.BufferAttribute
      const n = a.itemSize
      const arr = new (a.array.constructor as new (n: number) => Float32Array)(tris.length * 3 * n)
      tris.forEach((t, k) => {
        for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) arr[(k * 3 + v) * n + c] = a.array[(t * 3 + v) * n + c]
      })
      g.setAttribute(name, new THREE.BufferAttribute(arr, n, a.normalized))
    }
    g.computeBoundingSphere()
    out.push({ geo: g, c: g.boundingSphere!.center.clone(), r: g.boundingSphere!.radius })
  }
  if (geo !== src) geo.dispose()
  return out
}

/** a merged mesh that is split into z-chunks, each culled by frustum and distance */
export function ChunkedMesh({ geometry, material, edges = [-10, -45, -80], range = 62, renderOrder }: { geometry: THREE.BufferGeometry; material: THREE.Material; edges?: number[]; range?: number; renderOrder?: number }) {
  const chunks = useMemo(() => chunkGeometry(geometry, edges), [geometry, edges])
  useEffect(() => () => chunks.forEach((c) => c.geo.dispose()), [chunks])
  return (
    <group>
      {chunks.map((c, i) => (
        <ChunkMesh key={i} geo={c.geo} mat={material} c={c.c} r={c.r} range={range} renderOrder={renderOrder} />
      ))}
    </group>
  )
}

function ChunkMesh({ geo, mat, c, r, range, renderOrder }: { geo: THREE.BufferGeometry; mat: THREE.Material; c: THREE.Vector3; r: number; range: number; renderOrder?: number }) {
  const ref = useMemo(() => ({ current: null as THREE.Mesh | null }), [])
  useEffect(() => (ref.current ? registerCull(ref.current, [c.x, c.y, c.z], r, range) : undefined), [ref, c, r, range])
  return <mesh ref={(m) => { ref.current = m }} geometry={geo} material={mat} renderOrder={renderOrder} />
}
