import type Lenis from 'lenis'
import { rt } from './runtime'
import { clamp } from './math'

export const scroll = {
  lenis: null as Lenis | null,
  max: () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
}

/** Jump the journey to a progress point. The camera spring flies there cinematically (no hard cut). */
export function goTo(p: number, opts: { duration?: number } = {}) {
  const l = scroll.lenis
  const y = clamp(p) * scroll.max()
  const dist = Math.abs(p - rt.progress)
  const duration = opts.duration ?? (rt.reducedMotion ? 0.01 : clamp(1.6 + dist * 9, 1.6, 6.5))
  if (l) l.scrollTo(y, { duration, easing: (t: number) => 1 - Math.pow(1 - t, 3), force: true, lock: false })
  else window.scrollTo({ top: y })
}

export function lockScroll() {
  scroll.lenis?.stop()
}
export function unlockScroll() {
  scroll.lenis?.start()
}
