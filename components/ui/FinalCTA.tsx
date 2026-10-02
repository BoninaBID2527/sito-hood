'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent } from 'motion/react'
import { alterco, artist } from '@/data/project'
import { linksFor } from '@/data/streaming'
import { useStore } from '@/lib/store'
import { progressMV } from '@/lib/mv'
import { goTo } from '@/lib/scroll'

/** The end of the short film. Only configured streaming services are rendered. */
export function FinalCTA() {
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)
  const found = useStore((s) => s.dualismoFound)
  const visited = useStore((s) => s.visited.length)
  const [on, setOn] = useState(false)
  useMotionValueEvent(progressMV, 'change', (p) => {
    const v = p > 0.93
    if (v !== on) setOn(v)
  })
  const links = linksFor('alterco')
  const show = phase === 'entered' && mode === 'alterco' && on
  return (
    <AnimatePresence>
      {show && (
        <motion.section className="final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} aria-label="Listen">
          <div className="final-block">
            <motion.span className="label final-kicker" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              {artist.name}
            </motion.span>
            <h2 className="final-title display">
              {['ALTERCO'].map((w) => (
                <span className="mask" key={w}>
                  <motion.span style={{ display: 'inline-block' }} initial={{ y: '110%' }} animate={{ y: '0%' }} transition={{ delay: 0.45, type: 'spring', stiffness: 90, damping: 16 }}>
                    {w}
                  </motion.span>
                </span>
              ))}
            </h2>
            <motion.div className="final-listen" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <span className="label final-now">LISTEN NOW</span>
              <div className="final-links">
                {links.length > 0 ? (
                  links.map((l) => (
                    <a key={l.service} className="cta-link hit" data-cursor="link" data-cursor-label="PLAY" href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label} <span>↗</span>
                    </a>
                  ))
                ) : (
                  <span className="cta-soon label">LINKS COMING SOON{process.env.NODE_ENV !== 'production' ? ' · set URLs in data/streaming.ts' : ''}</span>
                )}
              </div>
              <span className="label final-meta">
                {alterco.meta.trackCount} TRACKS · {alterco.meta.minutes} MIN{visited === 7 ? ' · YOU HEARD IT ALL' : ''}
              </span>
            </motion.div>
          </div>
          <div className="final-foot">
            <button className="hit label replay" data-cursor="link" onClick={() => goTo(0, { duration: 7 })}>↑ REPLAY</button>
            <AnimatePresence>
              {!found && (
                <motion.span
                  className="label whisper-hint"
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 6, duration: 2.5 }}
                >
                  <span className="glyph" /> THERE IS ANOTHER SIDE
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
