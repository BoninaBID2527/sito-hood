'use client'

import { motion, useMotionValueEvent, useTransform } from 'motion/react'
import { useState } from 'react'
import { progressMV } from '@/lib/mv'
import { useStore } from '@/lib/store'
import { alterco, artist } from '@/data/project'

/**
 * The monumental titles are physical objects now (the two hung banners in the alley, see components/scene/street/Decals.tsx).
 * What stays in the interface is only a quiet one-line caption for each, timed to the same scroll ranges as before.
 */
function Tag({ text, range }: { text: string; range: [number, number, number, number] }) {
  const op = useTransform(progressMV, range, [0, 1, 1, 0])
  return (
    <motion.p className="title-tag label" style={{ opacity: op }} aria-hidden>
      {text}
    </motion.p>
  )
}

export function WorldTitles() {
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)
  const [show, setShow] = useState(true)
  useMotionValueEvent(progressMV, 'change', (p) => {
    const s = p > 0.045 && p < 0.34
    if (s !== show) setShow(s)
  })
  if (phase !== 'entered' || mode !== 'alterco' || !show) return null
  return (
    <div className="world-titles" aria-hidden>
      <Tag text={`${artist.tagline} — 02 PROJECTS`.toUpperCase()} range={[0.05, 0.1, 0.15, 0.2]} />
      <Tag text={`${alterco.title} — ${alterco.meta.trackCount} TRACKS — ${alterco.meta.minutes} MIN`} range={[0.19, 0.235, 0.29, 0.335]} />
    </div>
  )
}
