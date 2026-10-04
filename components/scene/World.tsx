'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { WorldGate } from './Director'
import { StreetEnvironment } from './StreetEnvironment'
import { Ambience } from './Ambience'
import { Dust } from './street/Atmos'
import { A, loadRoof, loadDualism } from '@/lib/assets'
import { useStore } from '@/lib/store'

// Code-split: the rooftop and the secret universe are separate chunks, fetched only after the user has entered.
const RooftopWorld = dynamic(() => import('./RooftopEnvironment').then((m) => m.RooftopWorld), { ssr: false })
const DualismoWorld = dynamic(() => import('./DualismoWorld').then((m) => m.DualismoWorld), { ssr: false })
// THE HOODDINO ROOM: its own chunk, requested only once the visitor has walked up to the street door (see lib/roomActions.warmRoom)
const RoomWorld = dynamic(() => import('./room/RoomWorld').then((m) => m.RoomWorld), { ssr: false })

export function World() {
  const phase = useStore((s) => s.phase)
  const roomLoad = useStore((s) => s.roomLoad)
  const [roof, setRoof] = useState(A.roofReady)
  const [dual, setDual] = useState(A.dualReady)

  // lazy: the rooftop is generated after the user has entered (idle time), long before they scroll there
  useEffect(() => {
    if (phase !== 'entered' || roof) return
    const t = setTimeout(async () => {
      await loadRoof()
      setRoof(true)
      await loadDualism()
      setDual(true)
    }, 1200)
    return () => clearTimeout(t)
  }, [phase, roof])

  return (
    <>
      <WorldGate world="alley">
        <StreetEnvironment />
      </WorldGate>
      {roof && (
        <WorldGate world="roof">
          <RooftopWorld />
        </WorldGate>
      )}
      {dual && (
        <WorldGate world="dualism">
          <DualismoWorld />
        </WorldGate>
      )}
      {roomLoad >= 1 && (
        <WorldGate world="room">
          <RoomWorld detail={roomLoad >= 2} />
        </WorldGate>
      )}
      <Dust />
      <Ambience />
    </>
  )
}
