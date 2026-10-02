'use client'

import { useEffect, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { whisper } from '@/lib/actions'
import { rt } from '@/lib/runtime'

/** Schedules the rare glitch (and renders the < 1 s hidden text). */
export function Whisper() {
  const text = useStore((s) => s.whisper)
  const phase = useStore((s) => s.phase)
  const pos = useMemo(() => ({ x: 8 + Math.random() * 60, y: 18 + Math.random() * 56 }), [text])
  useEffect(() => {
    if (phase !== 'entered') return
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        const s = useStore.getState()
        if (s.mode === 'alterco' && s.selected === null && !s.creditsOpen && rt.smooth > 0.1 && !rt.reducedMotion) whisper()
        loop()
      }, 32000 + Math.random() * 38000)
    }
    loop()
    return () => clearTimeout(t)
  }, [phase])
  if (!text) return null
  return (
    <div className="whisper display" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} aria-hidden>
      {text}
    </div>
  )
}
