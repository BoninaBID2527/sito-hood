'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'
import { room } from '@/lib/room'
import { SkyDome } from './SkyDome'

const ROOM_FOG = new THREE.Color('#100d0e')
const ROOM_SKY = new THREE.Color('#8d94a3')
const ROOM_GROUND = new THREE.Color('#2a1c1a')

/** Applies the time-of-day palette to fog + global lights each frame. */
export function Atmosphere() {
  const scene = useThree((s) => s.scene)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const bounceL = useRef<THREE.DirectionalLight>(null)
  const bounceR = useRef<THREE.DirectionalLight>(null)

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#8a7a6a', 0.016)
    scene.background = null
    return () => {
      scene.fog = null
    }
  }, [scene])

  useFrame(() => {
    const fog = scene.fog as THREE.FogExp2 | null
    const dual = rt.world === 'dualism'
    const inRoom = rt.world === 'room'
    if (fog) {
      if (inRoom) {
        fog.color.copy(ROOM_FOG)
        fog.density = 0.026
      } else if (dual) {
        fog.color.set('#0b1030')
        fog.density = 0.012
      } else {
        fog.color.copy(palette.fog)
        fog.density = palette.fogDensity
      }
    }
    if (hemi.current) {
      if (inRoom) {
        hemi.current.color.copy(ROOM_SKY)
        hemi.current.groundColor.copy(ROOM_GROUND)
        hemi.current.intensity = 1.7 * (1 - 0.5 * room.dim)
      } else {
        hemi.current.color.copy(dual ? new THREE.Color('#7fa8ff') : palette.hemiSky)
        hemi.current.groundColor.copy(dual ? new THREE.Color('#2a1a58') : palette.hemiGround)
        hemi.current.intensity = dual ? 1.0 : palette.hemiI * 1.25
      }
    }
    if (sun.current) {
      sun.current.color.copy(palette.sun)
      sun.current.intensity = inRoom ? 0 : dual ? 0.4 : palette.sunI * 0.42
    }
    if (fill.current) {
      fill.current.color.copy(palette.hemiSky)
      fill.current.intensity = inRoom ? 0 : dual ? 0.5 : rt.world === 'roof' ? 0.75 : 0.18
    }
    // soft bounce light from the opposite wall (no shadows → keeps both walls readable)
    for (const b of [bounceL.current, bounceR.current]) {
      if (!b) continue
      b.color.copy(palette.horizon).lerp(palette.hemiSky, 0.78)
      b.intensity = dual || inRoom ? 0 : 0.5 + palette.sunHeight * 0.2
    }
  }, -1)

  return (
    <>
      <SkyDome />
      <hemisphereLight ref={hemi} args={['#8fa4bf', '#3a2a28', 0.6]} />
      <directionalLight ref={sun} position={[14, 10, -80]} intensity={2} />
      <directionalLight ref={fill} position={[-6, 8, 20]} intensity={0.3} />
      <directionalLight ref={bounceL} position={[-9, 5, 0]} intensity={0.3} />
      <directionalLight ref={bounceR} position={[9, 5, 0]} intensity={0.3} />
    </>
  )
}
