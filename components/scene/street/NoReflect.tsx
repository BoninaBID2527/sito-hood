'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/**
 * Children render for the main camera only (layer 1). The planar reflection camera sees layer 0 only, so small / additive /
 * unimportant-in-a-puddle things (haze, wall furniture, laundry, steam) are not drawn twice.
 */
export function NoReflect({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(1))
  })
  return <group ref={ref}>{children}</group>
}
