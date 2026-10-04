'use client'

import { useWorldFrame } from '@/hooks/useWorldFrame'
import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { wallX } from './layout'

const Z = -33.4
const Y = 1.2
const SIDE = -1 as const

/**
 * Easter egg: a painted DUALISMO glyph on the left wall that only exists at a grazing angle.
 * Seen from far down the alley it shimmers; walk up to it and it vanishes (the wall is just a wall).
 */
export function GrazingSymbol() {
  const camera = useThree((s) => s.camera)
  const vis = useRef(0)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        uniforms: { uTime: { value: 0 }, uVis: { value: 0 }, uHover: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `
          varying vec2 vUv; uniform float uTime, uVis, uHover;
          float tri(vec2 p, float s){ return step(abs(p.x) * 1.0 + p.y * 0.0, s - abs(p.y)) ; }
          void main(){
            vec2 p = (vUv - 0.5) * 2.0;
            // hourglass: two triangles meeting at the centre, outlined
            float t1 = step(abs(p.x), p.y * 0.9) * step(p.y, 0.78);
            float t2 = step(abs(p.x), -p.y * 0.9) * step(-p.y, 0.78);
            float shape = max(t1, t2);
            float inner = max(step(abs(p.x), (p.y - 0.12) * 0.9) * step(p.y, 0.66), step(abs(p.x), (-p.y - 0.12) * 0.9) * step(-p.y, 0.66));
            float line = clamp(shape - inner, 0.0, 1.0);
            float dotc = smoothstep(0.1, 0.0, length(p));
            vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + p.y * 0.5 + uTime * 0.1));
            float a = (line * 0.85 + dotc * 0.9) * uVis * (0.65 + 0.35 * sin(uTime * 1.6)) * (1.0 + uHover);
            gl_FragColor = vec4(irid * a, a);
          }`,
      }),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(0.9, 0.9), [])
  const pos = useMemo(() => new THREE.Vector3(wallX(SIDE, Z) - SIDE * 0.1, Y, Z), [])
  const nrm = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const hov = useRef(0)
  const flag = useRef(false)
  useEffect(() => () => { mat.dispose(); geo.dispose() }, [mat, geo])
  useWorldFrame('alley', (_, dt) => {
    // grazing-angle visibility: 1 − |N·V| rises as the camera slides along the wall
    v.copy(camera.position).sub(pos).normalize()
    const g = 1 - Math.abs(v.dot(nrm))
    const dist = camera.position.distanceTo(pos)
    const target = THREE.MathUtils.smoothstep(g, 0.62, 0.9) * THREE.MathUtils.smoothstep(dist, 5, 11) * (rt.world === 'alley' && !rt.mirror ? 1 : 0)
    vis.current += (target - vis.current) * Math.min(1, dt * 4)
    hov.current += ((flag.current ? 1 : 0) - hov.current) * Math.min(1, dt * 6)
    mat.uniforms.uTime.value = rt.time
    mat.uniforms.uVis.value = vis.current
    mat.uniforms.uHover.value = hov.current
  })
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={pos}
      rotation={[0, Math.PI / 2, 0]}
      renderOrder={5}
      onPointerOver={(e) => {
        if (vis.current < 0.25) return
        e.stopPropagation()
        flag.current = true
        useStore.getState().setCursor('portal', '⧖')
      }}
      onPointerOut={() => {
        flag.current = false
        if (useStore.getState().cursor.kind === 'portal') useStore.getState().setCursor('default')
      }}
      onClick={(e) => {
        if (vis.current < 0.25) return
        e.stopPropagation()
        const st = useStore.getState()
        if (!st.eggs.includes('symbol')) {
          st.markEgg('symbol')
          st.say('TWO WAYS TO READ A WALL', 'Some things only exist from a distance.')
          rt.impulse.rgb = 0.02
        }
      }}
    />
  )
}
