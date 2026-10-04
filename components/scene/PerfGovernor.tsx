'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/lib/store'
import { SETTINGS, forcedTier } from '@/lib/quality'
import { createAdaptive } from '@/lib/adaptive'
import { rt } from '@/lib/runtime'

/**
 * Runtime adaptive quality (see lib/adaptive.ts for the policy). One useFrame, no allocations, no React state per frame.
 * `?quality=` pins a tier and turns adaptation off (developer testing).
 */
export function PerfGovernor() {
  const setDpr = useThree((s) => s.setDpr)
  const gl = useThree((s) => s.gl)
  const forced = useMemo(() => forcedTier() !== null, [])
  const ad = useMemo(() => {
    const tier = useStore.getState().tier
    return createAdaptive({
      start: tier,
      ceiling: tier,
      dpr: rt.dpr,
      apply: (t, d) => {
        rt.quality = SETTINGS[t]
        rt.dpr = d
        if (useStore.getState().tier !== t) useStore.getState().set({ tier: t })
        setDpr(d)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const last = useRef({ world: '' as string, hidden: false, mem: 0 })

  useFrame((_, dt) => {
    if (useStore.getState().phase !== 'entered') return
    const l = last.current
    if (rt.world !== l.world) { l.world = rt.world; ad.grace(2.5) }
    if (document.hidden !== l.hidden) { l.hidden = document.hidden; ad.grace(2) }
    if (forced) ad.observe(dt)
    else ad.tick(dt)
    // diagnostics (cheap field writes only)
    const p = rt.perf
    const s = ad.stats
    p.ms = s.ms; p.fps = s.fps; p.dpr = s.dpr; p.tier = s.tier; p.hitches = s.hitches; p.changes = s.changes; p.forced = forced
    p.calls = rt.stats.calls; p.tris = rt.stats.tris
    p.tex = gl.info.memory.textures; p.geo = gl.info.memory.geometries
  })
  return null
}
