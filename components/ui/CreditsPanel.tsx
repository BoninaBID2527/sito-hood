'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/lib/store'
import { closeCredits } from '@/lib/actions'
import { credits } from '@/data/credits'

/** Revealed by the hidden poster in the plaza. Content lives in data/credits.ts. */
export function CreditsPanel() {
  const open = useStore((s) => s.creditsOpen)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeCredits()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="credits hit" role="dialog" aria-modal="true" aria-label="Credits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeCredits}>
          <motion.div
            className="credits-sheet"
            initial={{ y: 40, rotate: -1.2, opacity: 0 }}
            animate={{ y: 0, rotate: -0.6, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="display credits-title">THE SMALL PRINT</h2>
            <dl>
              {credits.map((c) => (
                <div key={c.role + c.name} className="credits-row">
                  <dt className="label">{c.role}</dt>
                  <dd>{c.name}</dd>
                </div>
              ))}
            </dl>
            <button className="credits-close label hit" data-cursor="link" data-cursor-label="CLOSE" onClick={closeCredits} autoFocus>
              CLOSE ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
