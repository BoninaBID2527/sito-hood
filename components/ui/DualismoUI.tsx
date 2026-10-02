'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { dualismo, pad } from '@/data/project'
import { linksFor } from '@/data/streaming'
import { useStore } from '@/lib/store'
import { exitDualism } from '@/lib/actions'

/** Overlay for the secret universe. The way back is typographic, not a big button. */
export function DualismoUI() {
  const mode = useStore((s) => s.mode)
  const sel = useStore((s) => s.dualismoTrack)
  const on = mode === 'dualism'

  useEffect(() => {
    if (!on) return
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (useStore.getState().dualismoTrack !== null) useStore.getState().set({ dualismoTrack: null })
      else exitDualism()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [on])

  const tr = sel !== null ? dualismo.tracks[sel] : null
  const links = tr ? linksFor('dualismo', tr.id) : []
  return (
    <AnimatePresence>
      {on && (
        <motion.section className="dual-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, delay: 0.6 }} aria-label="Dualismo">
          <div className="dual-head">
            <span className="label">{dualismo.title}</span>
            <span className="label dim">{dualismo.meta.trackCount} TRACKS · {dualismo.meta.minutes} MIN</span>
          </div>
          <ol className="dual-tracks">
            {dualismo.tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  className={`dual-track hit ${sel === i ? 'is-sel' : ''}`}
                  data-cursor="link"
                  data-cursor-label="OPEN"
                  aria-pressed={sel === i}
                  onClick={() => useStore.getState().set({ dualismoTrack: sel === i ? null : i })}
                >
                  <i className="label">{pad(t.n)}</i>
                  <span className="display">{t.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <AnimatePresence mode="wait">
            {tr && (
              <motion.div key={tr.id} className="dual-detail" initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0 }}>
                <span className="label">{dualismo.title} — {pad(tr.n)} / {pad(dualismo.tracks.length)}</span>
                <div className="dual-links">
                  {links.length > 0 ? (
                    links.map((l) => (
                      <a key={l.service} className="cta-link hit" data-cursor="link" href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.label} <span>↗</span>
                      </a>
                    ))
                  ) : (
                    <span className="cta-soon label">LINKS COMING SOON{process.env.NODE_ENV !== 'production' ? ' · set URLs in data/streaming.ts' : ''}</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button className="dual-return hit" data-cursor="portal" data-cursor-label="RETURN" onClick={exitDualism}>
            <span className="dual-return-line" />
            <span className="label">RETURN TO ALTERCO</span>
            <span className="dual-return-arrow">↩</span>
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
