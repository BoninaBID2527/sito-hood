'use client'

import { useFrame } from '@react-three/fiber'
import { audio } from '@/lib/audio'
import { rt } from '@/lib/runtime'

/** Feeds the optional positional ambience: listener = camera, beds follow the world. Silent unless sound is enabled. */
let lastUi = 1
export function Ambience() {
  useFrame(({ camera }) => {
    audio.update(camera, rt.world, rt.time)
    // secondary UI steps back during the big cinematic moments (liquid, dissolve, tunnel, arrival). Navigation never goes below 45%.
    const f = rt.fx
    const busy = Math.max(f.liquid, f.cross, f.dissolve * 0.8, f.tunnel * 0.9, f.glitch * 0.5)
    const v = 1 - 0.55 * Math.min(1, busy)
    if (Math.abs(v - lastUi) > 0.015) {
      lastUi = v
      document.documentElement.style.setProperty('--ui-secondary', v.toFixed(2))
    }
  })
  return null
}
