'use client'

import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Director } from './Director'
import { PostFX } from '@/effects/PostFX'
import { Atmosphere } from '@/effects/Atmosphere'
import { World } from './World'
import { PerfGovernor } from './PerfGovernor'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { SETTINGS } from '@/lib/quality'
import { selectTrack } from '@/lib/actions'

export default function ExperienceCanvas() {
  const tier = useStore((s) => s.tier)
  const q = SETTINGS[tier]
  return (
    <Canvas
      className="canvas"
      dpr={[1, q.dprMax]}
      camera={{ fov: 50, near: 0.1, far: 700, position: [0, 1.7, 16] }}
      gl={{
        antialias: false, // MSAA happens on the HDR render target (see PostFX)
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        toneMapping: THREE.NoToneMapping, // tone mapping is done in the final pass
      }}
      onPointerMissed={() => {
        if (useStore.getState().selected !== null) selectTrack(null)
      }}
      onCreated={({ gl, camera }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__camera = camera
        gl.setClearColor('#000000', 1)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__gl = gl
        rt.quality = q
      }}
    >
      <Director />
      <Atmosphere />
      <World />
      <PostFX />
      <PerfGovernor />
    </Canvas>
  )
}
