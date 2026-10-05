'use client'

import { useRef } from 'react'
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

// @react-three/fiber still instantiates the (deprecated) THREE.Clock internally; hide only that one library notice.
if (typeof window !== 'undefined' && !(window as any).__clockWarnPatched) {
  ;(window as any).__clockWarnPatched = true
  const warn = console.warn.bind(console)
  console.warn = (...a: unknown[]) => {
    if (typeof a[0] === 'string' && a[0].includes('THREE.Clock')) return
    warn(...a)
  }
}

export default function ExperienceCanvas() {
  // initial DPR from the detected tier; afterwards the adaptive manager owns it (PerfGovernor → setDpr)
  const initial = useRef<number | null>(null)
  if (initial.current === null) {
    const q0 = SETTINGS[useStore.getState().tier]
    initial.current = Math.max(q0.dprMin, Math.min(window.devicePixelRatio || 1, q0.dprMax))
    rt.dpr = initial.current
  }
  return (
    <Canvas
      className="canvas"
      dpr={initial.current}
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
      onCreated={(state) => {
        const { gl, camera, scene, raycaster } = state
        gl.setClearColor('#000000', 1)
        camera.layers.enable(1) // layer 1 = main camera only (skipped by planar reflections)
        raycaster.layers.enable(1) // …but still pickable: interactive things may live on layer 1 (drawn once, not mirrored)
        rt.quality = SETTINGS[useStore.getState().tier]
        if (process.env.NODE_ENV !== 'production' || window.location.search.includes('debug')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.assign(window as any, { __gl: gl, __rc: raycaster, __scene: scene, __camera: camera, __r3f: state })
        }
        // a lost context cannot be resumed mid-journey: recover by reloading
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
        gl.domElement.addEventListener('webglcontextrestored', () => window.location.reload())
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
