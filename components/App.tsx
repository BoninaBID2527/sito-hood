'use client'

import { A } from '@/lib/assets'
import { PerfHud } from '@/components/ui/PerfHud'
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
import { RoomUI } from './ui/RoomUI'
import { CustomCursor } from './ui/CustomCursor'
import { Toast } from './ui/Toast'
import { CreditsPanel } from './ui/CreditsPanel'
import { Whisper } from './ui/Whisper'
import { SceneAnnouncer } from './ui/SceneAnnouncer'
import { startMotionBridge } from '@/lib/mv'
import { usePointerRig } from '@/hooks/usePointerRig'
import { useStore, detectTier } from '@/lib/store'
import { rt } from '@/lib/runtime'
import { SETTINGS } from '@/lib/quality'
import { loadCore, buildCards } from '@/lib/assets'
import { scroll } from '@/lib/scroll'
import * as actions from '@/lib/actions'
import * as roomActions from '@/lib/roomActions'
import { room } from '@/lib/room'
import { vid } from '@/lib/roomVideo'

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
    const tier = detectTier() // honours ?quality=mobile|balanced|high|ultra (legacy low/medium); otherwise device-based
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
      room,
      vid,
      act: (name: string, ...a: unknown[]) => ((actions as any)[name] ?? (roomActions as any)[name])?.(...a),
    }
  }, [])

  // shareable state: /?room=hooddino walks straight to the studio door and through it, right after ENTER (never before — no autoplay, no audio)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('room') !== 'hooddino') return
    const unsub = useStore.subscribe((s, prev) => {
      if (s.phase === 'entered' && prev.phase !== 'entered') {
        unsub()
        setTimeout(() => void roomActions.enterRoom({ direct: true }), 1200)
      }
    })
    return unsub
  }, [])

  const ready = useStore((s) => s.phase === 'ready' || s.phase === 'entered')
  const nogl = useStore((s) => s.phase === 'nogl')
  if (nogl) return <Fallback />

  return (
    <>
      <div className="stage" aria-hidden="true">{ready && <ExperienceCanvas />}</div>
      <div ref={spacer} className="scroll-spacer" />
      <ScrollRig spacerRef={spacer} />
      <PerfHud />
      <div className="overlay">
        <WorldTitles />
        <TrackUI />
        <TrackFocus />
        <FinalCTA />
        <DualismoUI />
        <RoomUI />
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
