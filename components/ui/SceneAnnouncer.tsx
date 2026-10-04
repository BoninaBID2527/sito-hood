'use client'

import { useState } from 'react'
import { useMotionValueEvent } from 'motion/react'
import { progressMV } from '@/lib/mv'
import { sceneAt } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { alterco, pad } from '@/data/project'
import { STATIONS } from '@/lib/room'

/** Screen-reader narration of the journey (aria-live). */
export function SceneAnnouncer() {
  const [scene, setScene] = useState('alley')
  const front = useStore((s) => s.front)
  const mode = useStore((s) => s.mode)
  const selected = useStore((s) => s.selected)
  const station = useStore((s) => s.roomStation)
  const focus = useStore((s) => s.roomFocus)
  useMotionValueEvent(progressMV, 'change', (p) => {
    const s = sceneAt(p).id
    if (s !== scene) setScene(s)
  })
  const msg =
    mode === 'room-in' ? 'Opening the studio door.' :
    mode === 'room-out' ? 'Leaving the room, back to the alley.' :
    mode === 'room' ? (focus ? 'Studio video focus. Controls: play or pause, sound, close.' : `The HOODDINO room. ${STATIONS[station].label}`) :
    mode === 'dualism' ? 'DUALISMO. Two tracks: Chirone and Messaggio.' :
    selected !== null ? `Track ${pad(alterco.tracks[selected].n)}: ${alterco.tracks[selected].title}` :
    scene === 'tracks' ? `The seven tracks. Front: ${pad(alterco.tracks[front].n)} ${alterco.tracks[front].title}` :
    scene === 'roof' ? 'Rooftop. Night falls over the city.' : 'The alley.'
  return <div className="sr-only" role="status" aria-live="polite">{msg}</div>
}
