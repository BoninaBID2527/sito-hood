'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { rt } from '@/lib/runtime'
import { scroll } from '@/lib/scroll'
import { SCROLL_VH } from '@/lib/timeline'
import { useStore } from '@/lib/store'

gsap.registerPlugin(ScrollTrigger)

/**
 * Smooth scroll (Lenis) → ScrollTrigger → rt.progress.
 * The page is a tall invisible spacer; the WebGL stage is fixed. Scroll position = film timeline.
 */
export function ScrollRig({ spacerRef }: { spacerRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const spacer = spacerRef.current
    if (!spacer) return
    let lastW = window.innerWidth
    const setHeight = () => {
      // lock the height to the *initial* viewport height on touch so URL-bar resizes never rescale the journey
      const vh = rt.touch ? Math.max(window.screen.height * 0.82, window.innerHeight) : window.innerHeight
      spacer.style.height = `${Math.round(vh * SCROLL_VH / 100) + window.innerHeight}px`
    }
    setHeight()

    const reduced = rt.reducedMotion
    const lenis = new Lenis({
      lerp: reduced ? 0.25 : 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1,
      syncTouch: false,
    })
    scroll.lenis = lenis
    lenis.stop() // locked until ENTER
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const st = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        rt.progress = self.progress
      },
    })
    ScrollTrigger.config({ ignoreMobileResize: true })

    const onResize = () => {
      if (window.innerWidth !== lastW || !rt.touch) {
        lastW = window.innerWidth
        setHeight()
        ScrollTrigger.refresh()
      }
    }
    window.addEventListener('resize', onResize)

    // keyboard: arrows / space / page keys scroll natively; Escape handled in UI
    const unsub = useStore.subscribe((s, prev) => {
      if (s.phase === 'entered' && prev.phase !== 'entered') lenis.start()
    })

    return () => {
      unsub()
      window.removeEventListener('resize', onResize)
      st.kill()
      gsap.ticker.remove(tick)
      lenis.destroy()
      scroll.lenis = null
    }
  }, [spacerRef])
  return null
}
