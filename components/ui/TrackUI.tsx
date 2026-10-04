'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent } from 'motion/react'
import { alterco, pad, trackLabel } from '@/data/project'
import { useStore } from '@/lib/store'
import { progressMV } from '@/lib/mv'
import { selectTrack } from '@/lib/actions'
import { jumpToTrack } from '@/lib/nav'
import { CP } from '@/lib/timeline'
import { linksFor, serviceLabel } from '@/data/streaming'
import { rt } from '@/lib/runtime'

/** Orbit-zone UI: current track readout, index list, prev/next, visited marks. */
export function TrackUI() {
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)
  const front = useStore((s) => s.front)
  const selected = useStore((s) => s.selected)
  const visited = useStore((s) => s.visited)
  const [on, setOn] = useState(false)
  useMotionValueEvent(progressMV, 'change', (p) => {
    const v = p > CP.tracksStart - 0.01 && p < CP.reveal - 0.01
    if (v !== on) setOn(v)
  })
  const show = phase === 'entered' && mode === 'alterco' && on && selected === null
  const tr = alterco.tracks[front]
  return (
    <AnimatePresence>
      {show && (
        <motion.section className="track-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} aria-label="Tracklist">
          <div className="tu-readout">
            {/* the title itself is built into the space around the object (3D typography); this is only the quiet index + controls */}
            <AnimatePresence mode="wait">
              <motion.div key={tr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                <span className="tu-count label" aria-live="polite">
                  {pad(tr.n)} / {pad(alterco.tracks.length)}
                  <span className="sr-only"> {tr.title}{tr.tag ? ` (${tr.tag})` : ''}</span>
                </span>
              </motion.div>
            </AnimatePresence>
            <div className="tu-controls">
              <button className="hit label tu-step" aria-label="Previous track" onClick={() => jumpToTrack((front + 6) % 7)}>←</button>
              <button className="tu-open label hit" data-cursor="link" data-cursor-label="OPEN" onClick={() => selectTrack(front)}>
                OPEN <span>→</span>
              </button>
              <button className="hit label tu-step" aria-label="Next track" onClick={() => jumpToTrack((front + 1) % 7)}>→</button>
            </div>
          </div>
          <ol className="tu-dots" aria-label="Tracks">
            {alterco.tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  className={`hit ${i === front ? 'is-front' : ''} ${visited.includes(i) ? 'is-seen' : ''}`}
                  data-cursor="link"
                  aria-label={`${pad(t.n)} ${trackLabel(t)}`}
                  aria-current={i === front}
                  onClick={() => jumpToTrack(i)}
                ><b /></button>
              </li>
            ))}
          </ol>
          <div className="tu-hint label">{rt.touch ? 'SWIPE · TAP' : 'SCROLL · DRAG · CLICK'}</div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

/** Cinematic focus view for a selected track. */
export function TrackFocus() {
  const selected = useStore((s) => s.selected)
  const visited = useStore((s) => s.visited)
  const tr = selected !== null ? alterco.tracks[selected] : null

  useEffect(() => {
    if (selected === null) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectTrack(null)
      if (e.key === 'ArrowRight') selectTrack(selected + 1)
      if (e.key === 'ArrowLeft') selectTrack(selected - 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [selected])

  const links = tr ? linksFor('alterco', tr.id) : []
  return (
    <AnimatePresence>
      {tr && (
        <motion.section key="focus" className="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} aria-label={`Track ${tr.n}: ${tr.title}`}>
          <div className="focus-text">
            <AnimatePresence mode="wait">
              <motion.div key={tr.id}>
                <motion.span className="focus-n label" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                  ALTERCO — TRACK {pad(tr.n)} / {pad(alterco.tracks.length)}
                </motion.span>
                <h2 className="focus-title display">
                  {tr.title.split(' ').map((w, i) => (
                    <span className="mask" key={w + i}>
                      <motion.span
                        style={{ display: 'inline-block' }}
                        initial={{ y: '110%', rotate: 4 }}
                        animate={{ y: '0%', rotate: 0 }}
                        transition={{ delay: 0.3 + i * 0.09, type: 'spring', stiffness: 110, damping: 18 }}
                      >
                        {w}&nbsp;
                      </motion.span>
                    </span>
                  ))}
                </h2>
                {tr.tag && (
                  <motion.span className="focus-tag label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                    ({tr.tag.toUpperCase()})
                  </motion.span>
                )}
                <motion.div className="focus-cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
                  {links.length > 0 ? (
                    links.map((l) => (
                      <a key={l.service} className="cta-link hit" data-cursor="link" data-cursor-label="PLAY" href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.label} <span>↗</span>
                      </a>
                    ))
                  ) : (
                    <span className="cta-soon label">LISTEN LINKS — COMING SOON{process.env.NODE_ENV !== 'production' ? ' · set URLs in data/streaming.ts' : ''}</span>
                  )}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="focus-controls">
            <button className="hit label" data-cursor="link" onClick={() => selectTrack(selected! - 1)} aria-label="Previous track">← PREV</button>
            <span className="label focus-count">{visited.length}/7 HEARD</span>
            <button className="hit label" data-cursor="link" onClick={() => selectTrack(selected! + 1)} aria-label="Next track">NEXT →</button>
          </div>
          <button className="focus-close hit label" data-cursor="link" data-cursor-label="CLOSE" onClick={() => selectTrack(null)} autoFocus>
            CLOSE <kbd>ESC</kbd>
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
