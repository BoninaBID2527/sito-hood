'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DOOR } from '@/lib/room'
import { GeoBuilder, worldUV } from '@/lib/geo'
import { plasterTex } from '@/lib/roomSurfaces'
import { fbm3 } from './bake'

/**
 * The dark airlock between the alley and the room (room-local frame: door plane at z = 0, depth `DOOR.depth` into the building).
 * Rendered twice with identical geometry: inside the street's prefab porch and as the room's own entrance, so the world swap that
 * happens while the camera is inside it is invisible. Two merged draws with
 * source-local baked light: the same installed surfaces in both worlds.
 */
export function Vestibule({ lit = 1 }: { lit?: number }) {
  const { geo, mat, hardware, hardwareMat, grain } = useMemo(() => {
    const w = 1.5, h = 2.5, d = DOOR.depth
    const box = new THREE.BoxGeometry(w, h, d, 8, 14, 7).toNonIndexed()
    // A passage has four faces, not six. The old end caps occluded both
    // the studio and the outside view even though an open leaf was rendered.
    const g = new THREE.BufferGeometry()
    for (const name of ['position', 'normal', 'uv']) {
      const source = box.getAttribute(name), values: number[] = []
      for (let i = 0; i < source.count; i++) {
        if (Math.abs(box.attributes.normal.getZ(i)) > .5) continue
        for (let j = 0; j < source.itemSize; j++) values.push(source.array[i * source.itemSize + j])
      }
      g.setAttribute(name, new THREE.Float32BufferAttribute(values, source.itemSize))
    }
    box.dispose()
    g.translate(0, h / 2, -d / 2)
    const pos = g.attributes.position, nor = g.attributes.normal
    const col = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const ny = nor.getY(i)
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      // Box normals point out; the visible ceiling has +y, floor has -y.
      const base = ny > 0.5 ? '#5b5b54' : ny < -0.5 ? '#343937' : y < .92 ? '#434a47' : '#77766a'
      const fixture = Math.exp(-((x * x * 1.6) + (z + d / 2) ** 2 * 1.1))
      const corners = (1 - .32 * Math.exp(-y / .12)) * (1 - .25 * Math.exp(-(h - y) / .1))
      const wear = .92 + .16 * fbm3(x * 2.1 + 4, y * 1.4, z * 2.1)
      c.set(base).multiplyScalar(lit * (.48 + .52 * fixture) * corners * wear)
      c.multiply(new THREE.Color(1.12, 1.02, .88))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    worldUV(g, 1.6)
    const grain = plasterTex(128)
    const mat = new THREE.MeshBasicMaterial({ map: grain, vertexColors: true, side: THREE.BackSide, fog: false })
    const b = new GeoBuilder()
    // Protective skirting, utility conduit with clips, switch, and the actual
    // ceiling channel. Hardware stays clear of the 1.2 m walking aperture.
    for (const side of [-1, 1]) {
      b.box(.018, .1, d, side * (w / 2 - .012), .05, -d / 2)
      b.box(.028, .028, d, side * (w / 2 - .024), 2.23, -d / 2)
      for (const z of [-.18, -.62, -1.08]) b.box(.035, .062, .022, side * (w / 2 - .028), 2.23, z)
    }
    b.box(.09, .12, .06, .7, 1.18, -.32)
      .box(.115, .055, d * .76, 0, 2.45, -d / 2)
      .box(.055, .012, d * .7, 0, 2.416, -d / 2)
    // Narrow jamb returns and a ribbed metal threshold give the otherwise
    // featureless closure real depth without suggesting invented street content.
    for (const side of [-1, 1]) b.box(.045, 2.2, .045, side * .64, 1.1, -.032)
    b.box(1.32, .045, .045, 0, 2.22, -.032)
    for (let j = 0; j < 5; j++) b.box(1.2, .008, .012, 0, .01, -.035 - j * .038)
    const hardware = b.build()
    const hp = hardware.attributes.position, hn = hardware.attributes.normal
    const hc = new Float32Array(hp.count * 3)
    for (let i = 0; i < hp.count; i++) {
      const emitting = hp.getY(i) > 2.4 && hp.getY(i) < 2.425 && Math.abs(hp.getX(i)) < .03
      c.set(emitting ? '#edcba2' : '#666b66').multiplyScalar(emitting ? 2.1 * lit : lit * (.38 + .35 * Math.max(0, hn.getY(i))))
      hc.set([c.r, c.g, c.b], i * 3)
    }
    hardware.setAttribute('color', new THREE.BufferAttribute(hc, 3))
    const hardwareMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })
    return { geo: g, mat, hardware, hardwareMat, grain }
  }, [lit])
  useEffect(() => () => { geo.dispose(); mat.dispose(); hardware.dispose(); hardwareMat.dispose(); grain.dispose() }, [geo, mat, hardware, hardwareMat, grain])
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <mesh geometry={hardware} material={hardwareMat} />
    </group>
  )
}
