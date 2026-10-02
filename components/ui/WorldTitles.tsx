'use client'

import { motion, useMotionValueEvent, useSpring, useTransform } from 'motion/react'
import { useState } from 'react'
import { pxMV, pyMV, progressMV, velocityMV } from '@/lib/mv'
import { useStore } from '@/lib/store'
import { alterco, artist } from '@/data/project'
import { rt } from '@/lib/runtime'

/**
 * Large screen-space typography that lives *inside* the scene's depth: each word is three stacked planes
 * (misregistered RGB ghosts + solid + outline) in a real CSS 3D context. The pointer separates the
 * planes in Z; scroll drives the mask-reveal and a blur-to-focus.
 */
function DepthWord({ text, range, tag, side = 'left' }: { text: string; range: [number, number, number, number]; tag: string; side?: 'left' | 'right' }) {
  const [a, b, c, d] = range
  const reveal = useTransform(progressMV, [a, b, c, d], [0, 1, 1, 0])
  const clip = useTransform(reveal, (v) => `inset(${(1 - Math.min(1, v * 1.15)) * 100}% 0 0 0)`)
  const y = useTransform(reveal, [0, 1], [70, 0])
  const blur = useTransform(reveal, (v) => `blur(${(1 - v) * 14}px)`)
  const op = useTransform(reveal, [0, 0.08, 1], [0, 1, 1])
  const rx = useSpring(useTransform(pyMV, (v) => -v * 7), { stiffness: 60, damping: 16 })
  const ry = useSpring(useTransform(pxMV, (v) => v * 9), { stiffness: 60, damping: 16 })
  // scroll speed pulls the layers apart a touch (RGB split)
  const split = useSpring(useTransform(velocityMV, (v) => Math.min(26, Math.abs(v) * 520)), { stiffness: 120, damping: 20 })
  const zBack = useTransform(split, (v) => -70 - v)
  const zFront = useTransform(split, (v) => 60 + v * 0.8)
  return (
    <motion.div className={`depth-word ${side}`} style={{ opacity: op, y, filter: blur, clipPath: clip, rotateX: rx, rotateY: ry }} aria-hidden>
      <div className="depth-stage">
        <motion.span className="dw-layer dw-back display" style={{ z: zBack }}>{text}</motion.span>
        <span className="dw-layer dw-mid display">{text}</span>
        <motion.span className="dw-layer dw-front display" style={{ z: zFront }}>{text}</motion.span>
      </div>
      <span className="dw-tag label">{tag}</span>
    </motion.div>
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
  if (phase !== 'entered' || mode !== 'alterco' || !show || rt.reducedMotion === undefined) return null
  return (
    <div className="world-titles" aria-hidden>
      <DepthWord text={artist.name} range={[0.05, 0.1, 0.15, 0.2]} tag={`${artist.tagline} — 02 PROJECTS`.toUpperCase()} />
      <DepthWord
        text={alterco.title}
        range={[0.19, 0.235, 0.29, 0.335]}
        tag={`${alterco.meta.trackCount} TRACKS — ${alterco.meta.minutes} MIN`}
        side="right"
      />
    </div>
  )
}
