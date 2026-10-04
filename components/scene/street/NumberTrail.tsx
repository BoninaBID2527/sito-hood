'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { foundNumber } from '@/lib/actions'
import { cellGeometry } from './atlasDecals'
import { streetMat } from './materials'
import { wallX } from './layout'
import { FIRE_ESCAPES, Y0 } from './FireEscapes'
import type { Cell } from '@/lib/graffiti'

const rotFor = (side: -1 | 1) => (side === -1 ? Math.PI / 2 : -Math.PI / 2)

/**
 * One of the seven numbers. Desktop: rest the pointer on it for a moment (or click). Touch: tap.
 * Visible mark + a generous invisible hit area (the marks are small and far away).
 */
export function NumberMark({ index, cell, atlas, position, rotation, w, hit = 2.6, children }: {
  index: number
  cell: Cell
  atlas: 'spray' | 'paper'
  position: [number, number, number]
  rotation: [number, number, number]
  w: number
  hit?: number
  children?: React.ReactNode
}) {
  const found = useStore((s) => s.nums[index])
  const tex = atlas === 'spray' ? A.graf.sprayTex : A.graf.paperTex
  const geo = useMemo(() => cellGeometry(cell), [cell])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9, emissive: new THREE.Color('#ffd9a0'), emissiveMap: tex, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    [tex],
  )
  const h = w / cell.aspect
  const state = useRef({ over: false, dwell: 0 })
  const grp = useRef<THREE.Group>(null)
  const wp = useMemo(() => new THREE.Vector3(...position), [position])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useFrame(({ camera }, dt) => {
    // a mark far behind / far ahead of the camera costs nothing (two passes: main + reflection)
    const near = camera.position.distanceToSquared(wp) < 70 * 70
    if (grp.current && grp.current.visible !== near) grp.current.visible = near
    if (!near) return
    const s = state.current
    if (s.over && !found) {
      s.dwell += dt
      if (s.dwell > 0.45) foundNumber(index)
    } else if (!s.over) s.dwell = Math.max(0, s.dwell - dt * 2)
    const target = s.over ? 0.9 : found ? 0.16 : 0.0
    mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 8)
  })
  const set = useStore.getState().setCursor
  return (
    <group ref={grp} position={position} rotation={rotation}>
      {children}
      <mesh geometry={geo} material={mat} scale={[w, h, 1]} renderOrder={6} />
      <mesh
        scale={[Math.max(w, 0.3) * hit, Math.max(h, 0.3) * hit, 1]}
        position={[0, 0, 0.03]}
        onPointerOver={(e) => { e.stopPropagation(); if (rt.touch) return; state.current.over = true; set('link', String(index + 1).padStart(2, '0')) }}
        onPointerOut={() => { state.current.over = false; set('default') }}
        onClick={(e) => { e.stopPropagation(); foundNumber(index) }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

/** The street part of the trail: 01 · 02 · 03 · 04 · 05 · 07 (06 is on the roof). */
export function NumberTrail() {
  const kit = useMemo(() => {
    const box = new THREE.BoxGeometry(0.2, 0.64, 0.52)
    const boxMat = streetMat({ color: '#7d8078', roughness: 0.62, metalness: 0.35, aoBase: 0.7, macro: 1 })
    const conduit = new THREE.CylinderGeometry(0.028, 0.028, 2.0, 8)
    const conduitMat = streetMat({ color: '#4c4b47', roughness: 0.6, metalness: 0.5, aoBase: 0.7 })
    const doorGeo = new THREE.PlaneGeometry(1.1, 2.3)
    const doorMat = streetMat({ map: A.doors[1], roughness: 0.58, metalness: 0.5, aoBase: 0.6, macro: 1 })
    const frameGeo = new THREE.BoxGeometry(0.16, 2.5, 1.3)
    const frameMat = streetMat({ color: '#2b2a28', roughness: 0.8, aoBase: 0.6 })
    return { box, boxMat, conduit, conduitMat, doorGeo, doorMat, frameGeo, frameMat }
  }, [])
  useEffect(() => () => Object.values(kit).forEach((d) => d.dispose()), [kit])

  const G = A.graf
  const fe = FIRE_ESCAPES.find((f) => f.side === 1 && f.z === -37)!
  const fx = wallX(1, fe.z)
  const Rx = (z: number) => wallX(1, z)
  const Lx = (z: number) => wallX(-1, z)
  return (
    <group>
      {/* 01 — stencil on a utility box with conduit */}
      <group>
        <mesh geometry={kit.box} material={kit.boxMat} position={[Rx(2.6) - 0.1, 1.5, 2.6]} />
        <mesh geometry={kit.conduit} material={kit.conduitMat} position={[Rx(2.6) - 0.05, 2.9, 2.28]} />
        <NumberMark index={0} cell={G.spr.n01} atlas="spray" position={[Rx(2.6) - 0.204, 1.5, 2.6]} rotation={[0, -Math.PI / 2, 0]} w={0.4} />
      </group>
      {/* 02 — sticker on the drainpipe */}
      <NumberMark index={1} cell={G.pap.stk_02} atlas="paper" position={[Lx(-42.7) + 0.11 + 0.078, 1.42, -42.7]} rotation={[0, Math.PI / 2, 0.12]} w={0.17} hit={3.2} />
      {/* 03 — a number painted on a door */}
      <group>
        <mesh geometry={kit.frameGeo} material={kit.frameMat} position={[Rx(-12.5) - 0.07, 1.25, -12.5]} />
        <mesh geometry={kit.doorGeo} material={kit.doorMat} position={[Rx(-12.5) - 0.16, 1.15, -12.5]} rotation={[0, -Math.PI / 2, 0]} />
        <NumberMark index={2} cell={G.spr.n03} atlas="spray" position={[Rx(-12.5) - 0.165, 1.62, -12.5]} rotation={[0, -Math.PI / 2, 0]} w={0.5} />
      </group>
      {/* 04 — the torn poster fragment (drawn by StreetGraffiti; this is its hit area) */}
      <HitOnly index={3} position={[Lx(-24.6) + 0.0755, 1.6, -24.6]} rotation={[0, Math.PI / 2, 0]} size={[0.55, 0.55]} />
      {/* 05 — a tag hidden inside the fire escape's wall */}
      <NumberMark index={4} cell={G.spr.n05} atlas="spray" position={[fx - 0.09, Y0 + 1.5, fe.z + 0.55]} rotation={[0, -Math.PI / 2, 0]} w={0.6} />
      {/* 07 — painted on the plaza, beside the water, mirrored in it */}
      <NumberMark index={6} cell={G.spr.n07} atlas="spray" position={[-4.1, 0.047, -92.4]} rotation={[-Math.PI / 2, 0, 0.06]} w={1.1} hit={2.2} />
    </group>
  )
}

function HitOnly({ index, position, rotation, size }: { index: number; position: [number, number, number]; rotation: [number, number, number]; size: [number, number] }) {
  const found = useStore((s) => s.nums[index])
  const state = useRef({ over: false, dwell: 0 })
  useFrame((_, dt) => {
    const s = state.current
    if (s.over && !found) { s.dwell += dt; if (s.dwell > 0.45) foundNumber(index) } else if (!s.over) s.dwell = 0
  })
  const set = useStore.getState().setCursor
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={[size[0] * 2.4, size[1] * 2.4, 1]}
      onPointerOver={(e) => { e.stopPropagation(); if (rt.touch) return; state.current.over = true; set('link', String(index + 1).padStart(2, '0')) }}
      onPointerOut={() => { state.current.over = false; set('default') }}
      onClick={(e) => { e.stopPropagation(); foundNumber(index) }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}
