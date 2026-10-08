'use client'

import { useEffect, useMemo } from 'react'
import { useWorldFrame } from '@/hooks/useWorldFrame'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { A } from '@/lib/assets'
import { palette } from '@/lib/timeOfDay'
import { streetMat } from './materials'
import { buildPlazaArch, type PlazaKey } from './plazaArch'

/**
 * V3.7 — the far end of the plaza: two rear blocks, a service passage with a footbridge, an end façade, the loading dock, roof plant, plaza ground
 * hardware. Merged per material (≈ a dozen draw calls); the windows come from the shared instanced window system (layout.ts).
 */
export function PlazaArch() {
  const kit = useMemo(() => {
    const built = buildPlazaArch()
    const wallMat = (k: 'dark' | 'red' | 'weathered', tint: string, seed: number) =>
      streetMat({ map: A.brick[k].map, roughness: 0.92, color: tint, side: THREE.FrontSide, aoBase: 0.4, brick: true, bump: A.brick[k].bump, bumpAmt: 1.4, seed, vertexColors: true, background: true })
    const wallMats = { rl: wallMat('dark', '#e8dcd2', 21.3), rr: wallMat('red', '#d6bcae', 23.1), end: wallMat('weathered', '#e0cdb8', 25.7) }
    const stone = streetMat({ map: A.sidewalk, color: '#6f6b63', roughness: 0.94, aoBase: 0.45, macro: 1.0, seed: 5.5, vertexColors: true })
    const mats: Record<Exclude<PlazaKey, 'rl' | 'rr' | 'end'>, THREE.Material> = {
      stone,
      steel: streetMat({ color: '#2a2b2e', roughness: 0.6, metalness: 0.7, aoBase: 0.6, vertexColors: true }),
      roof: streetMat({ color: '#2c2a27', roughness: 0.85, metalness: 0.2, aoBase: 0.6, vertexColors: true }),
      wood: streetMat({ color: '#5a4630', roughness: 0.95, aoBase: 0.5, vertexColors: true }),
      cap: streetMat({ color: '#9a8a3a', roughness: 0.8, aoBase: 0.5, vertexColors: true }),
      rubber: streetMat({ color: '#121212', roughness: 0.96, aoBase: 0.6, vertexColors: true }),
      crate: streetMat({ color: '#7a6246', roughness: 0.97, aoBase: 0.5, macro: 1.0, seed: 3.3, vertexColors: true }),
      glow: new THREE.MeshStandardMaterial({ color: '#2a1e12', emissive: new THREE.Color('#ffbb70'), emissiveIntensity: 1.6, roughness: 0.4 }),
      seam: new THREE.MeshStandardMaterial({ color: '#080707', roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      patch: new THREE.MeshStandardMaterial({ color: '#1a1918', roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      iron: streetMat({ color: '#18191b', roughness: 0.5, metalness: 0.65, aoBase: 0.6, vertexColors: true }),
    }
    const meshes: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []
    for (const k of ['rl', 'rr', 'end'] as const) {
      const list = built.walls.filter((w) => w.key === k).map((w) => w.geo)
      if (list.length) meshes.push({ geo: mergeGeometries(list, false)!, mat: wallMats[k] })
      list.forEach((g) => g.dispose())
    }
    for (const [k, g] of Object.entries(built.parts)) meshes.push({ geo: g!, mat: mats[k as keyof typeof mats] })
    // dock shutters / doors: textured planes (the same textures as the street-level items)
    const doorMats = new Map<string, THREE.Material>()
    const doorGeos: THREE.BufferGeometry[] = []
    const doorMeshes = built.doors.map((d) => {
      const tex = d.kind === 'shutter' ? A.shutters[d.variant] : A.doors[d.variant]
      const key = `${d.kind}${d.variant}`
      if (!doorMats.has(key)) doorMats.set(key, streetMat({ map: tex, roughness: 0.55, metalness: 0.55, color: '#ffffff', aoBase: 0.55 }))
      const geo = new THREE.PlaneGeometry(d.w, d.h)
      doorGeos.push(geo)
      return { geo, mat: doorMats.get(key)!, pos: [d.x, d.y, d.z] as [number, number, number], ry: d.ry ?? 0 }
    })
    // light spill: soft additive halos around the practical lamps and the bridge's lit glazing — what a real lamp does to the air and the wall around it
    // Same camera-facing practical halos, one instanced draw instead of one per lamp.
    const halo = new THREE.MeshBasicMaterial({ map: A.glow, color: '#ffb36a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })
    halo.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
        vec2 haloSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
        mvPosition.xy += transformed.xy * haloSize;
        gl_Position = projectionMatrix * mvPosition;
      `)
    }
    halo.customProgramCacheKey = () => 'plaza-practical-billboards-v37'
    const haloGeo = new THREE.PlaneGeometry(1, 1)
    const haloMesh = new THREE.InstancedMesh(haloGeo, halo, built.lamps.length)
    const matrix = new THREE.Matrix4()
    built.lamps.forEach((lamp, i) => {
      matrix.makeScale(lamp.s, lamp.s, 1).setPosition(...lamp.p)
      haloMesh.setMatrixAt(i, matrix)
    })
    haloMesh.instanceMatrix.needsUpdate = true
    haloMesh.computeBoundingSphere()
    haloMesh.layers.set(1)
    haloMesh.renderOrder = 5
    return { meshes, doorMeshes, wallMats, mats, doorMats, doorGeos, halo, haloGeo, haloMesh }
  }, [])

  useWorldFrame('alley', () => {
    // the lamps: dusk-dependent but never fully off
    ;(kit.mats.glow as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + palette.windows * 1.6
    kit.halo.opacity = 0.3 + palette.windows * 0.5
  }, -1)

  useEffect(
    () => () => {
      kit.meshes.forEach((m) => m.geo.dispose())
      kit.doorGeos.forEach((g) => g.dispose())
      Object.values(kit.wallMats).forEach((m) => m.dispose())
      Object.values(kit.mats).forEach((m) => m.dispose())
      kit.doorMats.forEach((m) => m.dispose())
      kit.haloMesh.dispose()
      kit.haloGeo.dispose()
      kit.halo.dispose()
    },
    [kit],
  )

  return (
    <group>
      {kit.meshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} />
      ))}
      <primitive object={kit.haloMesh} />
      {kit.doorMeshes.map((d, i) => (
        <mesh key={`d${i}`} geometry={d.geo} material={d.mat} position={d.pos} rotation={[0, d.ry, 0]} />
      ))}
    </group>
  )
}
