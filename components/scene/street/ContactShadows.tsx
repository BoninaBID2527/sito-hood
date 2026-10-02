'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makeCanvas, toTexture } from '@/lib/paint'
import { LAMPS } from './Lamps'
import { wallX } from './layout'

/**
 * Soft contact shadows under everything that stands on the ground. One instanced draw call, one tiny radial texture.
 * This is what stops props from looking like they hover over the asphalt.
 */
type Spot = { x: number; z: number; w: number; l: number; a: number; rot?: number }

function spots(): Spot[] {
  const out: Spot[] = []
  const side = (sd: -1 | 1, z: number, off: number, w: number, l: number, a = 0.6, rot = 0) => out.push({ x: wallX(sd, z) - sd * off, z, w, l, a, rot })
  for (const [sd, z] of [[-1, -9], [1, -31], [-1, -45], [1, 9], [-1, -57]] as const) side(sd, z, 0.95, 1.9, 2.8, 0.7, z % 2 ? 0.1 : -0.1)
  for (const [sd, z] of [[-1, -3], [1, -19], [-1, -22], [1, -41], [-1, -53], [1, -62], [-1, 4]] as const) side(sd, z, 0.7, 1.0, 1.0, 0.6)
  for (const [sd, z] of [[1, -8], [-1, -27], [1, -56], [-1, 12]] as const) side(sd, z, 0.75, 1.6, 1.7, 0.5)
  for (const [sd, z, o] of [[-1, 5.2, 0.62], [-1, 4.7, 0.9], [-1, 5.7, 0.8], [1, 2.2, 0.7], [1, 1.5, 1.0], [1, -17.6, 0.8], [-1, -36, 0.8]] as const) side(sd, z, o, 0.8, 0.8, 0.55)
  side(1, -25, 0.5, 0.7, 1.7, 0.4)
  // scooter
  out.push({ x: wallX(-1, 12.4) + 1.45, z: 12.4, w: 0.8, l: 2.1, a: 0.7, rot: 0.2 })
  // lamp bases, hydrants, plaza dumpsters, bollards
  for (const l of LAMPS) out.push({ x: l.x, z: l.z, w: 0.9, l: 0.9, a: 0.55 })
  out.push({ x: 2.2, z: -13, w: 0.8, l: 0.8, a: 0.5 }, { x: -7.5, z: -88, w: 0.8, l: 0.8, a: 0.5 })
  out.push({ x: -10.2, z: -80, w: 3.6, l: 2.2, a: 0.65 }, { x: -10.4, z: -83, w: 3.6, l: 2.2, a: 0.65 }, { x: 10.1, z: -106.2, w: 3.6, l: 2.2, a: 0.65 }, { x: 10.5, z: -113.6, w: 3.6, l: 2.2, a: 0.65 })
  for (let i = 0; i < 7; i++) out.push({ x: -5 + i * 1.6, z: -76.6, w: 0.5, l: 0.5, a: 0.45 })
  return out
}

export function ContactShadows() {
  const kit = useMemo(() => {
    const S = 128
    const { canvas, ctx } = makeCanvas(S, S)
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.95)')
    g.addColorStop(0.35, 'rgba(0,0,0,0.6)')
    g.addColorStop(0.7, 'rgba(0,0,0,0.18)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const tex = toTexture(canvas, { mipmaps: false, aniso: 1 })
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, color: '#000000', opacity: 0.62 })
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const list = spots()
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3()
    list.forEach((s, i) => {
      // sidewalk props sit on the kerb top (y≈0.17), everything else on the asphalt
      const onWalk = Math.abs(s.x) < 6 && Math.abs(Math.abs(s.x) - Math.abs(wallX(s.x < 0 ? -1 : 1, s.z))) < 1.1 && s.z > -76
      m4.compose(new THREE.Vector3(s.x, onWalk ? 0.175 : 0.034, s.z), q.setFromEuler(e.set(0, s.rot ?? 0, 0)), sc.set(s.w * 1.5, 1, s.l * 1.5))
      im.setMatrixAt(i, m4)
      im.setColorAt(i, new THREE.Color(s.a, s.a, s.a))
    })
    im.frustumCulled = false
    im.renderOrder = 1
    return { tex, mat, geo, im }
  }, [])
  useEffect(() => () => { kit.tex.dispose(); kit.mat.dispose(); kit.geo.dispose(); kit.im.dispose() }, [kit])
  return <primitive object={kit.im} />
}
