'use client'

import { useRef } from 'react'
import * as THREE from 'three'
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
import { Steam, Cables, AirLayers } from './street/Atmos'
import { Foreground } from './street/Foreground'
import { ContactShadows } from './street/ContactShadows'
import { NoReflect } from './street/NoReflect'
import { PlazaArch } from './street/PlazaArch'
import { FarGate, DistCull } from './street/DistCull'
import { WallDetail } from './street/WallDetail'
import { Backdrop } from './street/Backdrop'
import { TrackOrbit } from './TrackOrbit'
import { AltercoArtwork } from './AltercoArtwork'
import { StudioDoor } from './street/StudioDoor'

export function StreetEnvironment() {
  const root = useRef<THREE.Group>(null)
  useFrame(() => {
    if (root.current) root.current.scale.y = rt.mirror ? -1 : 1
    streetU.uTime.value = rt.time
    streetU.uContam.value = rt.fx.contam
    streetU.uMicro.value = rt.quality.level >= 1 ? 1 : 0
    streetU.uDissolve.value = rt.fx.dissolve
    // standing water gathers along the journey: ordinary wet street → puddles that keep growing → the pool
    const g = Math.min(1, Math.max(0, rt.smooth / 0.5))
    streetU.uPud.value = g * g * (3 - 2 * g)
    streetU.uWet.value = 0.3 + 0.7 * g
    streetU.uSunY.value = 24 - palette.sunHeight * 14
    streetU.uSunAmt.value = Math.min(1, palette.sunHeight * 1.4) * (palette.sunI > 0.6 ? 1 : 0.3)
    streetU.uSunCol.value.copy(palette.sun)
  }, -1)
  return (
    <group ref={root}>
      <Walls />
      <Windows />
      <PlazaArch />
      <StreetLevel />
      <GroundGate />
      <ContactShadows />
      <NoReflect><FireEscapes /></NoReflect>
      <FarGate><Props /></FarGate>
      <Lamps />
      <NoReflect><Decals /></NoReflect>
      <NoReflect><Steam /></NoReflect>
      <NoReflect><Cables /></NoReflect>
      <NoReflect><Foreground /></NoReflect>
      <FarGate><NoReflect><WallDetail /></NoReflect></FarGate>
      <NoReflect><AirLayers /></NoReflect>
      <Backdrop />
      <AltercoArtwork mode="plaza" />
      <TrackOrbit />
      {/* the studio entrance: not drawn (in either pass) unless the camera is within ~46 m of it */}
      <DistCull at={[-3.55, 1.3, -67]} r={46}><NoReflect><StudioDoor /></NoReflect></DistCull>
    </group>
  )
}

/** The ground (and its water layer) vanishes once we are inside the reflection. */
function GroundGate() {
  const g = useRef<THREE.Group>(null)
  useFrame(() => { if (g.current) g.current.visible = !rt.mirror }, -1)
  return <group ref={g}><Ground /></group>
}
