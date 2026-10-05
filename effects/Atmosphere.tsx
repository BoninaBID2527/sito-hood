'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'
import { room } from '@/lib/room'
import { streetU } from '@/components/scene/street/materials'
import { SkyDome } from './SkyDome'
import { updateSunShadow } from './sunShadow'

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

  const gl = useThree((s) => s.gl)
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#8a7a6a', 0.016)
    scene.background = null
    // the shadow map's filter type is fixed per session (changing it recompiles every material); its size / on-off follows the tier
    gl.shadowMap.type = rt.quality.shadowSoft ? THREE.PCFShadowMap : THREE.BasicShadowMap
    gl.shadowMap.enabled = rt.quality.shadow > 0
    const light = sun.current
    if (light) scene.add(light.target)
    return () => {
      scene.fog = null
      if (light) scene.remove(light.target)
    }
  }, [scene, gl])

  useFrame(({ camera }) => {
    const want = rt.quality.shadow > 0
    if (gl.shadowMap.enabled !== want) gl.shadowMap.enabled = want
    if (sun.current) updateSunShadow(sun.current, camera.position.z)
    const fog = scene.fog as THREE.FogExp2 | null
    const dual = rt.world === 'dualism'
    const inRoom = rt.world === 'room'
    if (fog) {
      if (inRoom) {
        fog.color.copy(ROOM_FOG)
        fog.density = 0.026
      } else if (dual) {
        fog.color.set('#070b26')
        fog.density = 0.0095
      } else {
        fog.color.copy(palette.fog)
        fog.density = palette.fogDensity
      }
    }
    // sky colours for the metal / glossy reflections (street, roof, DUALISMO, room each reflect their own sky)
    if (inRoom) { streetU.uSkyTop.value.set('#2a3144'); streetU.uSkyHor.value.set('#3a2f2c') }
    else if (dual) { streetU.uSkyTop.value.set('#10196a'); streetU.uSkyHor.value.set('#3a58d0') }
    else { streetU.uSkyTop.value.copy(palette.skyMid); streetU.uSkyHor.value.copy(palette.horizon) }
    if (hemi.current) {
      if (inRoom) {
        hemi.current.color.copy(ROOM_SKY)
        hemi.current.groundColor.copy(ROOM_GROUND)
        hemi.current.intensity = 2.4 * (1 - 0.5 * room.dim)
      } else {
        hemi.current.color.copy(dual ? new THREE.Color('#7fa8ff') : palette.hemiSky)
        hemi.current.groundColor.copy(dual ? new THREE.Color('#2a1a58') : palette.hemiGround)
        hemi.current.intensity = dual ? 0.78 : palette.hemiI * (rt.world === 'roof' ? 2.2 : 1.25)
      }
    }
    if (sun.current) {
      sun.current.color.copy(palette.sun)
      sun.current.intensity = inRoom ? 0 : dual ? 0.4 : palette.sunI * 0.42 * (rt.world === 'roof' && rt.quality.shadow > 0 ? 3 : 1)
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
      <directionalLight ref={sun} position={[14, 10, -80]} intensity={2} castShadow />
      <directionalLight ref={fill} position={[-6, 8, 20]} intensity={0.3} />
      <directionalLight ref={bounceL} position={[-9, 5, 0]} intensity={0.3} />
      <directionalLight ref={bounceR} position={[9, 5, 0]} intensity={0.3} />
    </>
  )
}
