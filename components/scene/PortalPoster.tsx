'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { enterDualism } from '@/lib/actions'
import { smoothstep } from '@/lib/math'

const vert = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
void main() {
  vUv = uv;
  vec3 p = position;
  // the top-right corner lifts and breathes — a poster that is slightly alive
  float curl = pow(max(0.0, uv.x + uv.y - 1.35), 2.0);
  p.z += curl * (0.35 + 0.08 * sin(uTime * 0.9));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tArt;
uniform sampler2D tPaper;
uniform float uTime;
uniform float uNear;
uniform float uLight;
void main() {
  vec4 paper = texture2D(tPaper, vUv);
  if (paper.a < 0.02) discard;
  vec2 c = vUv - vec2(0.5, 0.56);
  c.x *= 1.0; c.y *= 0.711; // poster is 512x720
  float r = length(vec2(c.x, c.y / 0.711 * 0.711));
  float R = 0.34;
  float inside = 1.0 - smoothstep(R - 0.006, R + 0.002, r);
  // radial zoom of the artwork, breathing; stronger as the pointer approaches
  float z = 0.05 + 0.2 * uNear + 0.03 * sin(uTime * 0.8);
  vec3 art = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float f = float(i) / 7.0;
    vec2 uv = 0.5 + (c / (R * 2.0)) * (1.0 - z * f);
    art.r += texture2D(tArt, uv + vec2(0.006 * uNear, 0.0)).r;
    art.g += texture2D(tArt, uv).g;
    art.b += texture2D(tArt, uv - vec2(0.006 * uNear, 0.0)).b;
  }
  art /= 7.0;
  art *= 0.75 + 0.7 * uNear;
  vec3 col = mix(paper.rgb * uLight, art, inside);
  float rim = smoothstep(R - 0.05, R, r) * (1.0 - smoothstep(R, R + 0.05, r));
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + r * 3.0 - uTime * 0.12));
  col += irid * rim * (0.22 + 0.9 * uNear + 0.12 * sin(uTime * 1.3));
  // a faint glow that leaks onto the paper
  col += irid * 0.16 * (1.0 - smoothstep(R, R + 0.38, r)) * (1.0 - inside) * (0.4 + uNear);
  gl_FragColor = vec4(col, paper.a);
}
`

/** The hidden DUALISMO portal: a torn wheat-paste with the official artwork bleeding through it. */
export function PortalPoster({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const camera = useThree((s) => s.camera)
  const ref = useRef<THREE.Mesh>(null)
  const hover = useRef(0)
  const wp = useMemo(() => new THREE.Vector3(), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: { tArt: { value: A.covers.dualismo }, tPaper: { value: A.portalPaper }, uTime: { value: 0 }, uNear: { value: 0 }, uLight: { value: 0.5 } },
      }),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1.45, 2.04, 20, 28), [])
  useEffect(() => () => { mat.dispose(); geo.dispose() }, [mat, geo])

  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    m.getWorldPosition(wp)
    const dz = camera.position.z - wp.z
    // screen-space proximity of the pointer to the poster (a quiet hint, never a label)
    const p = wp.clone().project(camera)
    const d = Math.hypot(p.x - rt.rx, (p.y - rt.ry) * 0.7)
    const inView = p.z < 1 && Math.abs(p.x) < 1.2 && dz > -2 && dz < 40 ? 1 : 0
    const prox = rt.touch ? 0.25 : smoothstep(0.5, 0.06, d)
    hover.current += (Math.max(prox, hover.current * 0) * inView + (hoverFlag.current ? 0.6 : 0) - hover.current) * Math.min(1, dt * 5)
    mat.uniforms.uTime.value = rt.time
    mat.uniforms.uNear.value = Math.min(1, hover.current + (useStore.getState().dualismoFound ? 0 : 0.12 * (0.5 + 0.5 * Math.sin(rt.time * 1.1))))
    mat.uniforms.uLight.value = 0.55 + 0.25 * (1 - rt.night)
  })
  const hoverFlag = useRef(false)

  return (
    <mesh
      ref={ref}
      geometry={geo}
      material={mat}
      position={position}
      rotation={[0, rotationY, 0.03]}
      onPointerOver={(e) => {
        e.stopPropagation()
        hoverFlag.current = true
        useStore.getState().setCursor('portal', useStore.getState().dualismoFound ? 'ENTER' : '?')
      }}
      onPointerOut={() => {
        hoverFlag.current = false
        useStore.getState().setCursor('default')
      }}
      onClick={(e) => {
        e.stopPropagation()
        enterDualism()
      }}
    />
  )
}
