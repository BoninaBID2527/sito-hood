'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/lib/store'
import { rt } from '@/lib/runtime'
import { STATIONS } from '@/lib/room'
import { enterRoom, exitRoom, goStation, nextStation, prevStation, focusVideo, closeFocus, toggleFocusedVideo, setSound, openLink } from '@/lib/roomActions'
import { vid, videoMode } from '@/lib/roomVideo'
import { roomBio, roomCopy, roomLinks, roomMedia } from '@/data/room'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * The room's interface. Small, secondary to the scene: an entrance offer in the street; inside, an unmistakable BACK TO STREET, a
 * station selector, the video controls, and a restrained quick-access list of the three real links (keyboard / reduced-motion / touch).
 * Everything here is real DOM (focusable, labelled); the 3D objects are an alternative way to reach the same things.
 */
export function RoomUI() {
  const phase = useStore((s) => s.phase)
  const mode = useStore((s) => s.mode)
  const near = useStore((s) => s.roomNear)
  const selected = useStore((s) => s.selected)
  const station = useStore((s) => s.roomStation)
  const focus = useStore((s) => s.roomFocus)
  const video = useStore((s) => s.video)
  const muted = useStore((s) => s.videoMuted)
  const time = useStore((s) => s.videoTime)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-aspect-ratio: 11/10)')
    const f = () => setNarrow(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const inRoom = mode === 'room'
  const moving = mode === 'room-in' || mode === 'room-out'

  // keyboard / wheel / swipe between stations — only inside the room, never a free camera
  useEffect(() => {
    if (!inRoom) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (useStore.getState().roomFocus) closeFocus(); else void exitRoom() }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { if ((e.target as HTMLElement)?.closest?.('input,textarea')) return; e.preventDefault(); nextStation() }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { if ((e.target as HTMLElement)?.closest?.('input,textarea')) return; e.preventDefault(); prevStation() }
    }
    let last = 0
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.room-bio')) return
      const now = performance.now()
      if (now - last < 650 || Math.abs(e.deltaY) < 8) return
      last = now
      if (e.deltaY > 0) nextStation(); else prevStation()
    }
    let sx = 0, sy = 0, st = 0
    const down = (e: PointerEvent) => { if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; st = performance.now() }
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !st) return
      const dx = e.clientX - sx, dy = e.clientY - sy
      const dt = performance.now() - st
      st = 0
      if (dt < 700 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) nextStation(); else prevStation() }
    }
    window.addEventListener('keydown', key)
    window.addEventListener('wheel', wheel, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [inRoom])

  if (phase !== 'entered') return null
  const offer = mode === 'alterco' && near && selected === null
  const st = STATIONS[station]
  const playing = video === 'playing' || video === 'loading'
  const domVideo = video === 'error' || videoMode() === 'dom'

  return (
    <>
      <AnimatePresence>
        {offer && (
          <motion.button
            key="offer"
            className="room-enter hit label"
            data-cursor="portal"
            data-cursor-label="ENTER"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5 }}
            onClick={() => void enterRoom()}
            aria-label="Enter the HOODDINO room"
          >
            <span className="room-enter-k">{roomCopy.title}</span>
            <span className="room-enter-v">ENTER →</span>
          </motion.button>
        )}
      </AnimatePresence>

      {(inRoom || moving) && (
        <div className="room-ui" data-room-ui>
          <motion.button
            className="room-exit hit label"
            data-cursor="link"
            initial={{ opacity: 0 }}
            animate={{ opacity: inRoom ? 1 : 0.4 }}
            transition={{ duration: 0.5, delay: inRoom ? 0.4 : 0 }}
            onClick={() => void exitRoom()}
            disabled={!inRoom}
            aria-label="Back to the street"
          >
            <span aria-hidden>←</span> BACK TO STREET
          </motion.button>

          <nav className="room-links label" aria-label="HOODDINO links">
            {(Object.keys(roomLinks) as (keyof typeof roomLinks)[]).map((k) => (
              <a key={k} className="hit" href={roomLinks[k].url} target="_blank" rel="noopener noreferrer" data-cursor="link" data-cursor-label={`${roomLinks[k].label} ↗`}>
                {roomLinks[k].label} <span aria-hidden>↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </nav>

          {inRoom && !focus && (
            <div className="room-stage">
              {st.id === 'workstation' && (
                <motion.button key="vid" className="room-chip hit" data-cursor="link" data-cursor-label="PLAY" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} onClick={() => focusVideo()}>
                  <span className="label room-chip-k">{roomCopy.videoLabel[0]}</span>
                  <span className="display room-chip-t">{roomCopy.videoLabel[1]}</span>
                  <span className="label room-chip-v">{roomCopy.videoLabel[2]}</span>
                </motion.button>
              )}
              {st.id === 'live' && (
                <motion.a key="live" className="room-chip hit" href={roomLinks.instagram.url} target="_blank" rel="noopener noreferrer" data-cursor="link" data-cursor-label="INSTAGRAM ↗" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <span className="display room-chip-t">{roomCopy.live[0]}</span>
                  <span className="label room-chip-v">{roomCopy.live[1]}</span>
                </motion.a>
              )}
              {st.id === 'bio' && narrow && (
                <motion.div key="bio" className="room-bio hit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <p className="label room-bio-k">{roomBio.meta[0]}</p>
                  <p className="room-bio-p">{roomBio.paragraph}</p>
                  <p className="label room-bio-m">{roomBio.meta[1]}</p>
                </motion.div>
              )}
              {st.id === 'exit' && (
                <motion.button key="out" className="room-chip hit" data-cursor="link" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} onClick={() => void exitRoom()}>
                  <span className="display room-chip-t">BACK TO STREET</span>
                  <span className="label room-chip-v">← THE ALLEY, WHERE YOU LEFT IT</span>
                </motion.button>
              )}
            </div>
          )}

          {inRoom && focus && (
            <motion.div className="room-controls hit" role="group" aria-label="Studio video controls" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <button className="label" onClick={() => toggleFocusedVideo()} aria-label={playing ? 'Pause video' : 'Play video'} data-cursor="link">
                {playing ? 'PAUSE' : video === 'ended' ? 'REPLAY' : 'PLAY'}
              </button>
              <button className="label" onClick={() => setSound(muted)} aria-pressed={!muted} aria-label={muted ? 'Turn video sound on' : 'Turn video sound off'} data-cursor="link">
                SOUND {muted ? 'OFF' : 'ON'}
              </button>
              <span className="label room-time" aria-label="Video time">{fmt(time)} / {fmt(roomMedia.videoDuration)}</span>
              <button className="label" onClick={() => closeFocus()} aria-label="Close video" data-cursor="link">CLOSE</button>
              {video === 'error' && (
                <a className="label room-fallback" href={roomMedia.video} target="_blank" rel="noopener noreferrer">OPEN THE VIDEO FILE ↗</a>
              )}
            </motion.div>
          )}
          {inRoom && focus && domVideo && <DomVideo />}

          {inRoom && (
            <div className="room-nav hit" role="group" aria-label="Room stations" style={{ opacity: focus ? 0 : 1, pointerEvents: focus ? 'none' : undefined }}>
              <button className="room-arrow" onClick={() => prevStation()} aria-label="Previous view" disabled={station === 0} data-cursor="link">‹</button>
              <ol className="room-dots">
                {STATIONS.map((s, i) => (
                  <li key={s.id}>
                    <button className={`room-dot ${i === station ? 'is-on' : ''}`} onClick={() => goStation(i)} aria-label={s.label} aria-current={i === station ? 'step' : undefined} data-cursor="link" />
                  </li>
                ))}
              </ol>
              <button className="room-arrow" onClick={() => nextStation()} aria-label="Next view" disabled={station === STATIONS.length - 1} data-cursor="link">›</button>
              <span className="label room-st" aria-hidden>{st.label}</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** DOM fallback for the studio video (only if the texture path fails or `?roomvideo=dom`): the same <video> element, in a vertical frame */
function DomVideo() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = host.current
    const el = vid.el
    if (!h || !el) return
    h.appendChild(el)
    el.style.display = 'block'
    return () => { if (el.parentElement === h) h.removeChild(el) }
  }, [])
  return <div ref={host} className="room-video-dom" aria-hidden={false} />
}

export { openLink }
