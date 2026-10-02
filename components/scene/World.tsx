'use client'

import { useEffect, useState } from 'react'
import { WorldGate } from './Director'
import { StreetEnvironment } from './StreetEnvironment'
import { RooftopWorld } from './RooftopEnvironment'
import { Dust } from './street/Atmos'
import { A, loadRoof, loadDualism } from '@/lib/assets'
import { DualismoWorld } from './DualismoWorld'
import { useStore } from '@/lib/store'

export function World() {
  const phase = useStore((s) => s.phase)
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
      <Dust />
    </>
  )
}
