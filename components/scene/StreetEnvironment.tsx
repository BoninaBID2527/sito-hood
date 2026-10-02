'use client'

import { useFrame } from '@react-three/fiber'
import { streetU } from './street/materials'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'
import { Walls, Windows, StreetLevel } from './street/Facades'
import { Ground } from './street/Ground'
import { FireEscapes } from './street/FireEscapes'
import { Lamps } from './street/Lamps'
import { Props } from './street/Props'
import { Decals } from './street/Decals'
import { Steam, Cables } from './street/Atmos'
import { Backdrop } from './street/Backdrop'
import { TrackOrbit } from './TrackOrbit'
import { AltercoArtwork } from './AltercoArtwork'

const SKIP = [
  { side: -1 as const, z: 7, r: 3.2 }, { side: 1 as const, z: -15, r: 3.2 }, { side: -1 as const, z: -29, r: 3 },
  { side: 1 as const, z: -49, r: 3 }, { side: -1 as const, z: -62, r: 2.8 }, { side: -1 as const, z: -50, r: 2.2 },
]

export function StreetEnvironment() {
  useFrame(() => {
    streetU.uTime.value = rt.time
    streetU.uContam.value = rt.fx.contam
    streetU.uSunY.value = 24 - palette.sunHeight * 14
    streetU.uSunAmt.value = Math.min(1, palette.sunHeight * 1.4) * (palette.sunI > 0.6 ? 1 : 0.3)
    streetU.uSunCol.value.copy(palette.sun)
  }, -1)
  return (
    <group>
      <Walls />
      <Windows />
      <StreetLevel skip={SKIP} />
      <Ground />
      <FireEscapes />
      <Props />
      <Lamps />
      <Decals />
      <Steam />
      <Cables />
      <Backdrop />
      <AltercoArtwork mode="plaza" />
      <TrackOrbit />
    </group>
  )
}
