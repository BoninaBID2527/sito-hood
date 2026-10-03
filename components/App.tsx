'use client'

import { A } from '@/lib/assets'
import { loadSecrets, resetSecrets } from '@/lib/secrets'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ScrollRig } from './ScrollRig'
import { Loader } from './ui/Loader'
import { Fallback } from './ui/Fallback'
import { HUD } from './ui/HUD'
import { WorldTitles } from './ui/WorldTitles'
import { TrackUI, TrackFocus } from './ui/TrackUI'
import { FinalCTA } from './ui/FinalCTA'
import { DualismoUI } from './ui/DualismoUI'
import { CustomCursor } from './ui/CustomCursor'
import { Toast } from './ui/Toast'
import { CreditsPanel } from './ui/CreditsPanel'
import { Whisper } from './ui/Whisper'
import { SceneAnnouncer } from './ui/SceneAnnouncer'
import { startMotionBridge } from '@/lib/mv'
import { usePointerRig } from '@/hooks/usePointerRig'
import { useStore, detectTier } from '@/lib/store'
import { rt } from '@/lib/runtime'
import { SETTINGS, type Tier } from '@/lib/quality'
import { loadCore, buildCards } from '@/lib/assets'
import { scroll } from '@/lib/scroll'
import * as actions from '@/lib/actions'

const ExperienceCanvas = dynamic(() => import('./scene/ExperienceCanvas'), { ssr: false })

export default function App() {
  const spacer = useRef<HTMLDivElement>(null)
  usePointerRig()
  useEffect(() => startMotionBridge(), [])

  useEffect(() => {
    // no WebGL → a static, fully readable fallback (the semantic DOM is always present as well)
    try {
      const c = document.createElement('canvas')
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('no webgl')
    } catch {
      useStore.getState().set({ phase: 'nogl' })
      return
    }
    const q = new URLSearchParams(window.location.search).get('quality') as Tier | null
    const tier = q && SETTINGS[q] ? q : detectTier()
    rt.quality = SETTINGS[tier]
    useStore.getState().set({ tier })
    rt.fx.fade = 0
    loadSecrets()
    let cancelled = false
    ;(async () => {
      await loadCore((p) => !cancelled && useStore.getState().set({ loadProgress: p * 0.92 }))
      await buildCards()
      if (cancelled) return
      useStore.getState().set({ loadProgress: 1, phase: 'ready' })
      // the world is already breathing behind the ENTER screen (dimmed, not black)
      if (!rt.reducedMotion) gsap.to(rt.fx, { fade: 0.58, duration: 3, ease: 'power2.out', delay: 0.9 })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // dev/test hook (only in dev or with ?debug): instantly jump the journey (bypasses Lenis easing)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !window.location.search.includes('debug')) return
    ;(window as any).__hd = {
      jump: (p: number) => {
        const y = p * Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
        scroll.lenis ? scroll.lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)
      },
      rt,
      A,
      store: useStore,
      reset: () => resetSecrets(),
      act: (name: string, ...a: unknown[]) => (actions as any)[name]?.(...a),
    }
  }, [])

  const ready = useStore((s) => s.phase === 'ready' || s.phase === 'entered')
  const nogl = useStore((s) => s.phase === 'nogl')
  if (nogl) return <Fallback />

  return (
    <>
      <div className="stage" aria-hidden="true">{ready && <ExperienceCanvas />}</div>
      <div ref={spacer} className="scroll-spacer" />
      <ScrollRig spacerRef={spacer} />
      <div className="overlay">
        <WorldTitles />
        <TrackUI />
        <TrackFocus />
        <FinalCTA />
        <DualismoUI />
        <HUD />
        <Toast />
        <Whisper />
      </div>
      <CreditsPanel />
      <SceneAnnouncer />
      <Loader />
      <CustomCursor />
    </>
  )
}
