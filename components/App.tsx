'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ScrollRig } from './ScrollRig'
import { Loader } from './ui/Loader'
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
    const q = new URLSearchParams(window.location.search).get('quality') as Tier | null
    const tier = q && SETTINGS[q] ? q : detectTier()
    rt.quality = SETTINGS[tier]
    useStore.getState().set({ tier })
    rt.fx.fade = 0
    try {
      if (localStorage.getItem('hd:dualismo')) useStore.getState().set({ dualismoFound: true })
    } catch {}
    let cancelled = false
    ;(async () => {
      await loadCore((p) => !cancelled && useStore.getState().set({ loadProgress: p * 0.92 }))
      await buildCards()
      if (cancelled) return
      useStore.getState().set({ loadProgress: 1, phase: 'ready' })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // dev/test hook: instantly jump the journey (bypasses Lenis easing)
  useEffect(() => {
    ;(window as any).__hd = {
      jump: (p: number) => {
        const y = p * Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
        scroll.lenis ? scroll.lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)
      },
      rt,
      store: useStore,
      act: (name: string, ...a: unknown[]) => (actions as any)[name]?.(...a),
    }
  }, [])

  const ready = useStore((s) => s.phase !== 'loading')

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
