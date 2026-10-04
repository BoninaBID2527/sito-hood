'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { room, DOOR } from '@/lib/room'
import { enterRoom, warmRoom } from '@/lib/roomActions'
import { doorLeafTexture, corrugatedTexture, doorSignTexture, spillTexture } from '@/lib/roomDoor'
import { streetMat } from './materials'
import { Vestibule } from '../room/Vestibule'
import { useWorldFrame } from '@/hooks/useWorldFrame'
import { GeoBuilder } from '@/lib/geo'

/**
 * THE ENTRANCE to the HOODDINO ROOM — a small prefab (painted corrugated steel, acoustic foam stapled to the brick, a red work
 * lamp, a padded door) bolted to the alley's left wall just before the plaza. The camera walks through its door.
 *
 * Cost: ~10 draw calls, no per-frame work while the street is on screen other than a distance test and (only while the door is
 * moving) the leaf rotation. Nothing here is drawn or updated in any other world.
 */
const W = 1.9 // porch width (along the wall)
const H = 2.65
const FRONT = 0.34 // width of the pillars either side of the opening

export function StudioDoor() {
  const leaf = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const spillMesh = useRef<THREE.Mesh>(null)
  const kit = useMemo(() => {
    const steel = corrugatedTexture()
    steel.repeat.set(1, 1)
    const leafTex = doorLeafTexture()
    const sign = doorSignTexture()
    const spill = spillTexture()
    const mats = {
      steel: streetMat({ map: steel, roughness: 0.6, metalness: 0.55, color: '#ffffff', aoBase: 0.55 }),
      frame: streetMat({ color: '#1a1b1c', roughness: 0.7, metalness: 0.5, aoBase: 0.5 }),
      leaf: streetMat({ map: leafTex, roughness: 0.55, metalness: 0.1, color: '#ffffff', aoBase: 0.5 }),
      sign: new THREE.MeshBasicMaterial({ map: sign, fog: true }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a2a').multiplyScalar(2.2), fog: false }),
      glow: new THREE.MeshBasicMaterial({ map: spill, color: new THREE.Color('#ff9650'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      foam: streetMat({ color: '#18191c', roughness: 0.98, aoBase: 0.5 }),
    }
    // shell, frame and foam are merged: three draw calls for the whole prefab (+ leaf, plate, lamp)
    const hw = W / 2, op = DOOR.w / 2, depth = DOOR.depth
    const shell = new GeoBuilder()
      .box(W + 0.1, 0.1, depth + 0.1, 0, H + 0.04, -depth / 2)
      .box(0.08, H, depth, -hw + 0.02, H / 2, -depth / 2)
      .box(0.08, H, depth, hw - 0.02, H / 2, -depth / 2)
      .box(FRONT, H, 0.1, -(op + FRONT / 2), H / 2, 0.02)
      .box(FRONT, H, 0.1, op + FRONT / 2, H / 2, 0.02)
      .box(DOOR.w + 0.02, H - DOOR.h, 0.1, 0, DOOR.h + (H - DOOR.h) / 2, 0.02)
      .build()
    const frame = new GeoBuilder()
      .box(0.06, DOOR.h, 0.1, -op - 0.02, DOOR.h / 2, 0.06)
      .box(0.06, DOOR.h, 0.1, op + 0.02, DOOR.h / 2, 0.06)
      .box(DOOR.w + 0.1, 0.06, 0.1, 0, DOOR.h + 0.02, 0.06)
      .build()
    const foam = new GeoBuilder()
      .box(0.55, 1.9, 0.07, -hw - 0.3, 1.45, 0.02)
      .box(0.55, 1.4, 0.07, hw + 0.3, 1.2, 0.02)
      .build()
    const geos = { shell, frame, foam }
    const disposables: { dispose(): void }[] = [steel, leafTex, sign, spill, ...Object.values(mats), ...Object.values(geos)]
    return { mats, geos, disposables }
  }, [])
  useEffect(() => () => kit.disposables.forEach((d) => d.dispose()), [kit])

  // distance test (street only): is the visitor close enough for the entrance to be offered?
  const near = useRef(false)
  useWorldFrame('alley', ({ camera }) => {
    const p = camera.position
    const n = room.phase === 'off' && Math.abs(p.z - DOOR.z) < 13 && p.z > DOOR.z - 12 && p.x > DOOR.x - 1
    if (n !== near.current) {
      near.current = n
      room.near = n
      useStore.getState().set({ roomNear: n })
      if (n) warmRoom() // approach: shell textures + the (not yet loading) video element
    }
    // the leaf and the lamp follow the camera's progress toward the door
    if (leaf.current) {
      const target = room.door * 1.72
      if (Math.abs(leaf.current.rotation.y - target) > 1e-3) leaf.current.rotation.y = target
    }
    // the airlock and the spill on the pavement exist only while the door is (being) opened
    const open = room.door > 0.01
    if (inner.current && inner.current.visible !== open) inner.current.visible = open
    if (spillMesh.current) {
      if (spillMesh.current.visible !== open) spillMesh.current.visible = open
      kit.mats.glow.opacity = room.door * 0.55
    }
  })

  const op = DOOR.w / 2 // half opening
  return (
    <group position={[DOOR.x, 0, DOOR.z]} rotation={[0, Math.PI / 2, 0]}>
      {/* interior airlock (only drawn once the door starts to open) */}
      <group ref={inner} visible={false}><Vestibule /></group>
      {/* the prefab: painted corrugated steel shell, door frame, acoustic foam stapled to the brick beside it */}
      <mesh geometry={kit.geos.shell} material={kit.mats.steel} />
      <mesh geometry={kit.geos.frame} material={kit.mats.frame} />
      <mesh geometry={kit.geos.foam} material={kit.mats.foam} />
      {/* padded leaf, hinged on the left jamb, swings into the airlock */}
      <group ref={leaf} position={[-op, 0, 0.02]}>
        <mesh material={kit.mats.leaf} position={[op, DOOR.h / 2, 0]}><boxGeometry args={[DOOR.w - 0.02, DOOR.h - 0.02, 0.07]} /></mesh>
      </group>
      {/* enamel plate + the red work lamp over the door (a motivated, unmistakable cue) */}
      <mesh material={kit.mats.sign} position={[0, H - 0.2, 0.085]}><planeGeometry args={[1.45, 0.36]} /></mesh>
      <mesh material={kit.mats.lamp} position={[op + FRONT / 2, DOOR.h + 0.28, 0.12]}><sphereGeometry args={[0.075, 10, 8]} /></mesh>
      {/* warm spill from the open door onto the pavement */}
      <mesh ref={spillMesh} visible={false} material={kit.mats.glow} position={[0, 0.012, 1.15]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.5, 2.3]} /></mesh>
      <DoorHit />
    </group>
  )
}

/** the hit area for the street door: click = knock and go in; nothing is drawn */
function DoorHit() {
  return (
    <mesh
      position={[0, 1.3, 0.3]}
      onPointerOver={(e) => {
        if (useStore.getState().mode !== 'alterco' || !room.near) return
        e.stopPropagation()
        useStore.getState().setCursor('portal', 'ENTER')
      }}
      onPointerOut={() => {
        if (useStore.getState().cursor.label === 'ENTER') useStore.getState().setCursor('default')
      }}
      onClick={(e) => {
        if (useStore.getState().mode !== 'alterco' || !room.near || rt.world !== 'alley') return
        e.stopPropagation()
        void enterRoom()
      }}
    >
      <boxGeometry args={[W + 0.4, 2.9, 0.9]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}
