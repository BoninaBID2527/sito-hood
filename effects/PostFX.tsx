'use client'

import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { postFrag, postVert } from './postfx.glsl'
import { rt } from '@/lib/runtime'
import { A } from '@/lib/assets'

/**
 * Takes over rendering: scene → HDR render target → one custom full-screen pass
 * (chromatic aberration, bloom-on-lights, liquid/tunnel transitions, grain, vignette, tone-map).
 */
export function PostFX() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const kit = useMemo(() => {
    const exts = gl.extensions
    const half = exts.has('EXT_color_buffer_float') || exts.has('EXT_color_buffer_half_float')
    const target = new THREE.WebGLRenderTarget(4, 4, {
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      samples: gl.capabilities.isWebGL2 ? rt.quality.msaa : 0,
      colorSpace: THREE.LinearSRGBColorSpace,
    })
    const mat = new THREE.ShaderMaterial({
      vertexShader: postVert,
      fragmentShader: postFrag,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tScene: { value: target.texture },
        tArt: { value: null },
        tArt2: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uRgb: { value: 0 },
        uLiquid: { value: 0 },
        uCross: { value: 0 },
        uTunnel: { value: 0 },
        uContam: { value: 0 },
        uFade: { value: 0 },
        uGlitch: { value: 0 },
        uNeg: { value: 0 },
        uGrain: { value: 0.5 },
        uVig: { value: 0.5 },
        uExposure: { value: 1 },
        uBloom: { value: 0.3 },
        uDual: { value: 0 },
        uDim: { value: 0 },
        uRipple: { value: new THREE.Vector3() },
        uPointer: { value: new THREE.Vector2() },
      },
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    const sc = new THREE.Scene()
    sc.add(quad)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    return { target, mat, sc, cam, quad }
  }, [gl])

  useEffect(() => {
    const v = new THREE.Vector2()
    gl.getDrawingBufferSize(v)
    kit.target.setSize(Math.max(2, v.x), Math.max(2, v.y))
    kit.mat.uniforms.uRes.value.copy(v)
    kit.mat.uniforms.uAspect.value = v.x / v.y
  }, [gl, kit, size, dpr])

  useEffect(
    () => () => {
      kit.target.dispose()
      kit.mat.dispose()
      kit.quad.geometry.dispose()
    },
    [kit],
  )

  useFrame((_, dt) => {
    const u = kit.mat.uniforms
    const f = rt.fx
    if (!u.tArt.value && A.covers) u.tArt.value = A.covers.alterco
    // transient impulses decay on their own
    rt.impulse.rgb *= Math.exp(-dt * 6)
    rt.impulse.glitch *= Math.exp(-dt * 9)
    f.ripple *= Math.exp(-dt * 2.2)

    u.uTime.value = rt.time
    u.uRgb.value = (f.rgb + rt.impulse.rgb) * (rt.reducedMotion ? 0.3 : 1)
    const red = rt.reducedMotion
    u.uLiquid.value = red ? 0 : f.liquid
    u.uCross.value = red ? 0 : f.cross
    u.uTunnel.value = red ? 0 : f.tunnel
    u.uContam.value = f.contam
    u.uFade.value = f.fade * (red ? 1 - Math.max(f.tunnel, Math.max(0, (f.liquid - 0.55) / 0.45)) : 1)
    u.uGlitch.value = rt.reducedMotion ? 0 : f.glitch + rt.impulse.glitch
    u.uNeg.value = f.negative
    u.uGrain.value = f.grain * rt.quality.grain
    u.uVig.value = f.vignette
    u.uExposure.value = f.exposure
    u.uBloom.value = rt.quality.bloom * (1 - f.liquid)
    u.uDual.value = f.dualism
    u.uDim.value = f.focusDim
    u.uRipple.value.set(f.rippleX, f.rippleY, f.ripple)

    gl.info.autoReset = false
    gl.info.reset()
    gl.setRenderTarget(kit.target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    rt.stats.calls = gl.info.render.calls
    rt.stats.tris = gl.info.render.triangles
    gl.render(kit.sc, kit.cam)
  }, 1)

  return null
}
