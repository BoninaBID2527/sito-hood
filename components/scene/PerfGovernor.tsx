'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/lib/store'
import { SETTINGS, stepTier } from '@/lib/quality'
import { rt } from '@/lib/runtime'

/**
 * Adaptive quality. Watches frame time; if the device can't hold ~40fps for two
 * consecutive 2-second windows, drop one tier (DPR, MSAA, reflections, particles, bloom).
 * `?quality=high|medium|low` pins a tier and disables adaptation (used for testing).
 */
export function PerfGovernor() {
  const setDpr = useThree((s) => s.setDpr)
  const acc = useRef({ t: 0, n: 0, bad: 0, cool: 4 })
  useFrame((_, dt) => {
    const a = acc.current
    if (useStore.getState().phase !== 'entered') return
    if (new URLSearchParams(window.location.search).has('quality')) return
    a.cool -= dt
    if (a.cool > 0) return
    a.t += dt
    a.n++
    if (a.t >= 2) {
      const avg = a.t / a.n
      a.bad = avg > 0.026 ? a.bad + 1 : 0
      a.t = 0
      a.n = 0
      if (a.bad >= 2) {
        a.bad = 0
        const cur = useStore.getState().tier
        const next = stepTier(cur, 1)
        if (next !== cur) {
          useStore.getState().set({ tier: next })
          rt.quality = SETTINGS[next]
          setDpr(Math.min(window.devicePixelRatio, SETTINGS[next].dprMax))
          a.cool = 4
        }
      }
    }
  })
  return null
}
