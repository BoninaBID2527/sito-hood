'use client'

import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Hides its children while the camera is farther than `r` metres from `at` — small, detailed things in a long alley cost nothing
 * (in both the main and the reflection pass) when they are far behind or far ahead of the viewer.
 */
export function DistCull({ at, r = 70, children }: { at: [number, number, number]; r?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const p = useRef(new THREE.Vector3(...at))
  useFrame(({ camera }) => {
    const g = ref.current
    if (!g) return
    const near = camera.position.distanceToSquared(p.current) < r * r
    if (g.visible !== near) g.visible = near
  })
  return <group ref={ref}>{children}</group>
}
