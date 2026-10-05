'use client'

import { useEffect, useRef, useState } from 'react'
import { rt } from '@/lib/runtime'

/**
 * Developer diagnostics, only with `?perf=1`. No analytics, nothing stored or sent. Updates the DOM directly (no React state per tick).
 */
export function PerfHud() {
  const [on, setOn] = useState(false)
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get('perf') === '1')
  }, [])
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => {
      const p = rt.perf
      if (!ref.current) return
      const cv = document.querySelector('.stage canvas') as HTMLCanvasElement | null
      const buf = cv ? `${cv.width}×${cv.height} for css ${cv.clientWidth}×${cv.clientHeight} (×${(cv.width / Math.max(1, cv.clientWidth)).toFixed(2)}, device ×${(window.devicePixelRatio || 1).toFixed(2)})` : '–'
      ref.current.textContent =
        `${p.fps.toFixed(0)} fps  ${p.ms.toFixed(1)} ms` +
        `\np95 ${p.p95.toFixed(1)}  p99 ${p.p99.toFixed(1)}  worst ${p.worst.toFixed(0)} ms` +
        `\ntier ${p.tier}${p.forced ? ' (pinned)' : ''}  dpr ${p.dpr.toFixed(2)}  scale ${rt.scale.toFixed(2)}` +
        `\ncpu ${p.cpu.toFixed(1)} ms  bound ${p.bound}` +
        `\ncalls ${p.calls}  tris ${(p.tris / 1000).toFixed(0)}k` +
        `\ntex ${p.tex}  geo ${p.geo}` +
        `\nhitches ${p.hitches}  adapt ${p.changes}` +
        `\nbuffer ${buf}` +
        `\nrender ${cv ? Math.floor(cv.width * rt.scale) : 0}×${cv ? Math.floor(cv.height * rt.scale) : 0}` +
        (p.events.length ? `\n${p.events.slice(-4).join('\n')}` : '') +
        `\nworld ${rt.world}  p ${rt.smooth.toFixed(3)}`
    }, 400)
    return () => window.clearInterval(id)
  }, [on])
  if (!on) return null
  return (
    <pre
      ref={ref}
      aria-hidden
      style={{ position: 'fixed', left: 8, top: 52, zIndex: 300, margin: 0, padding: '6px 8px', font: '10px/1.35 ui-monospace, Menlo, monospace', color: '#9fffb4', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none', whiteSpace: 'pre', borderRadius: 4 }}
    />
  )
}
