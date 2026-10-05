'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '@/lib/store'
import { SETTINGS, forcedTier, isTouchDevice } from '@/lib/quality'
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
    const ad = createAdaptive({
      start: tier,
      ceiling: tier,
      dpr: rt.dpr,
      // touch devices start a notch below full scale and ramp up once the device has proven it can hold 60 (no stutter in the first seconds)
      scale0: rt.touch || isTouchDevice() ? 0.9 : 1,
      apply: (t, d, sc) => {
        rt.quality = SETTINGS[t]
        rt.scale = sc
        // the canvas DPR only moves with a tier change (re-allocation); the scale handles everything in between
        if (Math.abs(rt.dpr - d) > 0.001) { rt.dpr = d; setDpr(d) }
        if (useStore.getState().tier !== t) useStore.getState().set({ tier: t })
      },
    })
    // developer pin: `?scale=0.7` fixes the internal render scale (with `?quality=` the manager is off)
    const q = Number(new URLSearchParams(window.location.search).get('scale'))
    rt.scale = q >= 0.4 && q <= 1 ? q : forced ? 1 : ad.stats.scale
    return ad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const last = useRef({ world: '' as string, hidden: false, mem: 0 })

  useFrame((_, dt) => {
    if (useStore.getState().phase !== 'entered') return
    const l = last.current
    if (rt.world !== l.world) { l.world = rt.world; ad.grace(2.5) }
    if (document.hidden !== l.hidden) { l.hidden = document.hidden; ad.grace(2) }
    if (forced) ad.observe(dt, rt.cpuMs)
    else ad.tick(dt, rt.cpuMs)
    // diagnostics (cheap field writes only)
    const p = rt.perf
    const s = ad.stats
    p.ms = s.ms; p.fps = s.fps; p.dpr = s.dpr; p.scale = s.scale; p.p95 = s.p95; p.p99 = s.p99; p.worst = s.worst; p.cpu = s.cpu; p.bound = s.bound; p.events = s.events; p.tier = s.tier; p.hitches = s.hitches; p.changes = s.changes; p.forced = forced
    p.calls = rt.stats.calls; p.tris = rt.stats.tris
    p.tex = gl.info.memory.textures; p.geo = gl.info.memory.geometries
  })
  return null
}
