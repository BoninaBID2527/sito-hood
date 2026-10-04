'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DOOR } from '@/lib/room'

/**
 * The dark airlock between the alley and the room (room-local frame: door plane at z = 0, depth `DOOR.depth` into the building).
 * Rendered twice with identical geometry: inside the street's prefab porch and as the room's own entrance, so the world swap that
 * happens while the camera is inside it is invisible. One draw call, unlit, vertex-lit gradient (brighter toward the door).
 */
export function Vestibule({ lit = 1 }: { lit?: number }) {
  const { geo, mat, strip } = useMemo(() => {
    const w = 1.5, h = 2.5, d = DOOR.depth
    const g = new THREE.BoxGeometry(w, h, d, 1, 1, 4).toNonIndexed()
    g.translate(0, h / 2, -d / 2)
    const pos = g.attributes.position, nor = g.attributes.normal
    const col = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      // inside faces: floor warm-dark, ceiling very dark, walls in between; darker with depth
      const ny = nor.getY(i)
      const base = ny > 0.5 ? '#0c0a09' : ny < -0.5 ? '#1c1613' : '#17120f'
      const t = Math.min(1, -pos.getZ(i) / d)
      c.set(base).multiplyScalar(lit * (1.15 - t * 0.85))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a54').multiplyScalar(1.6), fog: false })
    return { geo: g, mat, strip }
  }, [lit])
  useEffect(() => () => { geo.dispose(); mat.dispose(); strip.dispose() }, [geo, mat, strip])
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      {/* a warm work-light strip along the ceiling: the only motivated light in the airlock */}
      <mesh material={strip} position={[0, 2.46, -DOOR.depth / 2]}>
        <boxGeometry args={[0.07, 0.025, DOOR.depth * 0.7]} />
      </mesh>
    </group>
  )
}
