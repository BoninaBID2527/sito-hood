'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useSpring } from 'motion/react'
import { useStore } from '@/lib/store'
import { enterExperience } from '@/lib/actions'
import { rng } from '@/lib/math'
import { rt } from '@/lib/runtime'

const WORD = 'HOODDINO'
const SUB = 'ALTERCO'

/**
 * Designed pre-load: the wordmark itself is the progress indicator. While assets stream in the letters
 * are misregistered (RGB split + skew); as the count approaches 100 they lock into focus.
 */
export function Loader() {
  const phase = useStore((s) => s.phase)
  const target = useStore((s) => s.loadProgress)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 70, damping: 22, mass: 0.6 })
  const [pct, setPct] = useState(0)
  const [chaos, setChaos] = useState(1)
  const [leaving, setLeaving] = useState(false)
  const r = useMemo(() => rng(5), [])
  const seeds = useMemo(() => [...WORD, ...SUB].map(() => ({ x: r.range(-1, 1), y: r.range(-1, 1), s: r.range(-1, 1) })), [r])
  const tick = useRef(0)

  useEffect(() => {
    mv.set(target * 100)
  }, [target, mv])
  useMotionValueEvent(spring, 'change', (v) => {
    const p = Math.min(100, Math.round(v))
    setPct(p)
    setChaos(1 - p / 100)
  })
  // jitter the misregistration a little so it feels like unstable film
  useEffect(() => {
    if (rt.reducedMotion) return
    const id = setInterval(() => (tick.current = (tick.current + 1) % 1000), 90)
    return () => clearInterval(id)
  }, [])

  const ready = phase === 'ready' && pct >= 100
  const done = phase === 'entered'

  useEffect(() => {
    if (done) setLeaving(true)
  }, [done])

  const letter = (ch: string, i: number, big: boolean) => {
    const s = seeds[i]
    const k = chaos * (rt.reducedMotion ? 0 : 1)
    const j = Math.sin(tick.current * 1.7 + i) * 0.5
    const off = (big ? 7 : 4) * k * (1 + j * 0.4)
    return (
      <span
        key={`${ch}${i}`}
        className="ld-letter"
        style={{
          transform: `translate(${s.x * 6 * k}px, ${s.y * 6 * k}px) skewX(${s.s * 10 * k}deg)`,
          textShadow: `${-off}px 0 rgba(255,60,80,${0.75 * k}), ${off}px 0 rgba(60,200,255,${0.75 * k})`,
          filter: `blur(${k * 1.4}px)`,
        }}
      >
        {ch}
      </span>
    )
  }

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          className={`loader${ready ? ' is-ready' : ''}`}
          role="status"
          aria-live="polite"
          aria-label={`Loading ${pct}%`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 2.2, ease: [0.65, 0, 0.35, 1], delay: 0.2 } }}
        >
          <motion.div className="ld-word display" exit={{ scale: 1.08, filter: 'blur(14px)', transition: { duration: 1.6, ease: 'easeIn' } }}>
            <div className="ld-line">{[...WORD].map((c, i) => letter(c, i, true))}</div>
            <div className="ld-line ld-sub">{[...SUB].map((c, i) => letter(c, WORD.length + i, false))}</div>
          </motion.div>
          <div className="ld-foot">
            <div className="ld-count display" aria-hidden>
              {String(pct).padStart(2, '0')}
              <span>%</span>
            </div>
            <AnimatePresence mode="wait">
              {ready ? (
                <motion.div
                  key="enter"
                  className="ld-actions"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                >
                  <button className="ld-enter hit" data-cursor="portal" data-cursor-label="ENTER" onClick={() => enterExperience(true)} autoFocus>
                    <span className="ld-enter-line" />
                    ENTER ALTERCO
                    <span className="ld-arrow">→</span>
                  </button>
                  <button className="ld-silent hit label" data-cursor="link" data-cursor-label="ENTER" onClick={() => enterExperience(false)}>
                    ENTER WITHOUT SOUND
                  </button>
                </motion.div>
              ) : (
                <motion.div key="wait" className="label ld-wait" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}>
                  LOADING THE ALLEY
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

