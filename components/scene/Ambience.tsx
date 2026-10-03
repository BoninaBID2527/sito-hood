'use client'

import { useFrame } from '@react-three/fiber'
import { audio } from '@/lib/audio'
import { rt } from '@/lib/runtime'

/** Feeds the optional positional ambience: listener = camera, beds follow the world. Silent unless sound is enabled. */
export function Ambience() {
  useFrame(({ camera }) => {
    audio.update(camera, rt.world, rt.time)
  })
  return null
}
