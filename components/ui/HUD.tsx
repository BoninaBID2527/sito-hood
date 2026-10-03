'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useTransform } from 'motion/react'
import { useStore } from '@/lib/store'
import { progressMV } from '@/lib/mv'
import { goTo } from '@/lib/scroll'
import { NAV_POINTS } from '@/lib/timeline'
import { sceneAt, SCENES, timeLabel } from '@/lib/nav'
import { enterDualism, hoodClick, toggleSound } from '@/lib/actions'
import { enableTilt } from '@/hooks/usePointerRig'
import { rt } from '@/lib/runtime'

/** Small persistent interface: wordmark, signage-style navigation, scene index, progress rail, sound. */
export function HUD() {
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)
  const sound = useStore((s) => s.sound)
  const found = useStore((s) => s.dualismoFound)
  const menu = useStore((s) => s.menu)
  const hidden = useStore((s) => s.selected !== null || s.creditsOpen)
  const [scene, setScene] = useState<(typeof SCENES)[number]>(SCENES[0])
  const [tod, setTod] = useState('LATE AFTERNOON')
  const [moved, setMoved] = useState(false)
  const [tilt, setTilt] = useState(false)

  useMotionValueEvent(progressMV, 'change', (p) => {
    const s = sceneAt(p)
    if (s.id !== scene.id) setScene(s)
    const t = timeLabel(p)
    if (t !== tod) setTod(t)
    if (!moved && p > 0.015) setMoved(true)
  })

  const railFill = useTransform(progressMV, [0, 1], [0, 1])
  useEffect(() => {
    if (menu) {
      const k = (e: KeyboardEvent) => e.key === 'Escape' && useStore.getState().set({ menu: false })
      window.addEventListener('keydown', k)
      return () => window.removeEventListener('keydown', k)
    }
  }, [menu])

  if (phase !== 'entered') return null
  const inDual = mode === 'dualism' || mode === 'dualism-in' || mode === 'dualism-out'
  const active = scene.id === 'alley' ? 'alterco' : scene.id === 'tracks' ? 'tracks' : 'listen'

  const go = (p: number) => {
    useStore.getState().set({ menu: false })
    if (inDual) return
    goTo(p)
  }

  return (
    <>
      <motion.header className="hud-top" initial={{ opacity: 0, y: -14 }} animate={{ opacity: hidden ? 0 : 1, y: 0 }} transition={{ delay: 1.2, duration: 1 }}>
        <button className="wordmark display hit" onClick={hoodClick} data-cursor="link" aria-label="HOODDINO">
          HOODDINO
        </button>
        <nav className="nav" aria-label="Journey">
          {NAV_POINTS.map((n, i) => (
            <button key={n.id} className={`nav-item hit label ${active === n.id && !inDual ? 'is-active' : ''}`} data-cursor="link" onClick={() => go(n.p)}>
              <i>0{i + 1}</i>
              {n.label}
              {active === n.id && !inDual && <motion.span layoutId="nav-underline" className="nav-underline" />}
            </button>
          ))}
          <button
            className={`nav-item nav-secret hit label ${found ? 'is-found' : ''} ${inDual ? 'is-active' : ''}`}
            data-cursor="link"
            disabled={!found || inDual}
            onClick={() => enterDualism()}
            aria-label={found ? 'Dualismo' : 'Locked'}
          >
            <i>04</i>
            {found ? 'DUALISMO' : '· · ·'}
          </button>
        </nav>
        <button className="menu-btn label hit" aria-expanded={menu} onClick={() => useStore.getState().set({ menu: !menu })}>
          {menu ? 'CLOSE' : 'MENU'}
        </button>
      </motion.header>

      <motion.footer className="hud-bottom" initial={{ opacity: 0 }} animate={{ opacity: hidden ? 0 : 1 }} transition={{ delay: 1.6, duration: 1 }}>
        <div className="scene-index label">
          <AnimatePresence mode="wait">
            <motion.span key={inDual ? 'dual' : scene.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}>
              {inDual ? '∞ — DUALISMO' : `${scene.n} — ${scene.label}`}
              <em>{inDual ? 'ANOTHER SIDE' : tod}</em>
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="hud-actions">
          {rt.touch && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && (
            <button
              className={`tilt-btn label hit ${tilt ? 'is-on' : ''}`}
              onClick={async () => setTilt(await enableTilt())}
              aria-pressed={tilt}
            >
              TILT
            </button>
          )}
          <button className="sound-btn label hit" data-cursor="link" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute sound' : 'Turn sound on'}>
            <span className={`eq ${sound ? 'on' : ''}`}>
              <b /><b /><b /><b />
            </span>
            {sound ? 'SOUND' : 'MUTED'}
          </button>
        </div>
      </motion.footer>

      {!inDual && (
        <motion.div className="rail" initial={{ opacity: 0 }} animate={{ opacity: hidden ? 0 : 1 }} transition={{ delay: 2, duration: 1 }} aria-hidden>
          <div className="rail-track">
            <motion.div className="rail-fill" style={{ scaleY: railFill }} />
          </div>
          {NAV_POINTS.map((n) => (
            <button key={n.id} className="rail-tick hit" style={{ top: `${n.p * 100}%` }} data-cursor="link" onClick={() => go(n.p)} tabIndex={-1} />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {!moved && !inDual && (
          <motion.div className="hint label" initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} exit={{ opacity: 0 }} transition={{ delay: 3.2, duration: 1.2 }}>
            <span className="hint-line" />
            SCROLL
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && (
          <motion.div className="menu hit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <ul>
              {[...NAV_POINTS.map((n) => ({ ...n, action: () => go(n.p) })), ...(found ? [{ id: 'dualismo', label: 'DUALISMO', p: 0, hint: '∞', action: () => { useStore.getState().set({ menu: false }); enterDualism() } }] : [])].map((n, i) => (
                <motion.li key={n.id} initial={{ opacity: 0, y: 40, rotateX: -50 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.08 * i + 0.1, type: 'spring', stiffness: 110, damping: 16 }}>
                  <button className="display" onClick={n.action}>
                    <i className="label">0{i + 1}</i>
                    {n.label}
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
