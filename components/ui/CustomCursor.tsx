'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useStore } from '@/lib/store'
import { rt } from '@/lib/runtime'

/** Minimal contextual cursor (desktop only). Spring-smoothed, never laggy. */
export function CustomCursor() {
  const kind = useStore((s) => s.cursor.kind)
  const label = useStore((s) => s.cursor.label)
  const phase = useStore((s) => s.phase)
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 900, damping: 46, mass: 0.28 })
  const sy = useSpring(y, { stiffness: 900, damping: 46, mass: 0.28 })

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine || rt.touch) return
    setEnabled(true)
    document.documentElement.classList.add('has-cursor')
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      x.set(e.clientX)
      y.set(e.clientY)
      setVisible(true)
    }
    const leave = () => setVisible(false)
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [x, y])

  // the ENTER button unmounts under the pointer: never leave its label behind
  useEffect(() => {
    if (phase === 'entered') useStore.getState().setCursor('default')
  }, [phase])

  // DOM controls report their own hover state through data-cursor
  useEffect(() => {
    if (!enabled) return
    const over = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-cursor]') as HTMLElement | null
      const st = useStore.getState()
      const onCanvas = !!(e.target as HTMLElement | null)?.closest?.('canvas')
      if (el) st.setCursor((el.dataset.cursor as any) ?? 'link', el.dataset.cursorLabel)
      else if (['link', 'text'].includes(st.cursor.kind) && !onCanvas) st.setCursor('default')
      // first-visit hint: until the first scroll the cursor invites you to explore the world
      if (!el && onCanvas && st.phase === 'entered' && st.mode === 'alterco' && rt.progress < 0.02 && st.cursor.kind === 'default') st.setCursor('explore', 'EXPLORE')
      else if (st.cursor.kind === 'explore' && (!onCanvas || rt.progress >= 0.02)) st.setCursor('default')
    }
    window.addEventListener('pointerover', over, { passive: true })
    return () => window.removeEventListener('pointerover', over)
  }, [enabled])

  if (!enabled) return null
  const size = kind === 'default' ? 10 : kind === 'explore' ? 64 : kind === 'link' || kind === 'lamp' ? 42 : kind === 'track' || kind === 'drag' ? 92 : 70
  return (
    <motion.div className={`cursor cursor-${kind}`} style={{ x: sx, y: sy, opacity: visible && phase !== 'loading' ? 1 : 0 }} aria-hidden>
      <motion.div
        className="cursor-ring"
        animate={{
          width: size,
          height: size,
          borderRadius: kind === 'portal' ? ['50%', '42% 58% 55% 45%', '58% 42% 46% 54%', '50%'] : '50%',
          rotate: kind === 'portal' ? [0, 90, 180, 270] : 0,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 30, borderRadius: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 6, repeat: Infinity, ease: 'linear' } }}
      >
        {label && kind !== 'default' && <span className="cursor-label">{label}</span>}
      </motion.div>
    </motion.div>
  )
}
