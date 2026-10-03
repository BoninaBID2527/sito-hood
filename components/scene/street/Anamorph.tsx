'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ALLEY_KEYS } from '@/lib/timeline'
import { FONT } from '@/lib/graffiti'
import { audio } from '@/lib/audio'
import { rt } from '@/lib/runtime'
import { useStore } from '@/lib/store'
import { smoothstep } from '@/lib/math'

/**
 * THE ONE ANAMORPHIC MARK.
 * ALTERCO is painted on the road surface so that it only reads as a word from a single camera position — the exact pose
 * of the scroll camera at the 0.165 keyframe. From anywhere else it is a long smear of worn road paint.
 * Nothing announces it. Near alignment the paint answers a little (a hair of colour separation, a softer glow, a far glass tone).
 * It uses the normal scroll camera, so it works identically on touch.
 */
const KEY = ALLEY_KEYS[4]
const V = new THREE.Vector3(...KEY.pos)
const VFWD = new THREE.Vector3(...KEY.look).sub(V).normalize()
const ASPECT = 16 / 9
/** where the word sits in the virtual camera's image (ndc centre, half width) — height follows the mask's aspect */
const CX = 0, CY = -0.765, HW = 0.26
const MASK = { w: 1024, h: 256 }
const HH = (HW * (MASK.h / MASK.w) * 2 * ASPECT) / 2

function buildMask() {
  const c = document.createElement('canvas')
  c.width = MASK.w; c.height = MASK.h
  const x = c.getContext('2d')!
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height)
  x.font = `${Math.round(MASK.h * 0.86)}px ${FONT.bungee}`
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.fillStyle = '#fff'
  // fit to width
  const w = x.measureText('ALTERCO').width
  const k = Math.min(1, (MASK.w * 0.94) / w)
  x.save(); x.translate(MASK.w / 2, MASK.h * 0.54); x.scale(k, 1)
  x.fillText('ALTERCO', 0, 0)
  x.restore()
  // spray break-up: a few knocked-out specks along the edges so it is paint, not vector
  let s = 7
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  x.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 900; i++) { x.globalAlpha = 0.5 + r() * 0.5; x.fillRect(r() * MASK.w, r() * MASK.h, 1 + r() * 2.4, 1 + r() * 2.4) }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.anisotropy = 4
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

export function Anamorph() {
  const align = useRef(0)
  const lastCue = useRef(-100)
  const kit = useMemo(() => {
    // the virtual camera: view-projection of the scroll camera at its 0.165 keyframe
    const vp = new THREE.Matrix4()
    const vc = new THREE.PerspectiveCamera(KEY.fov ?? 50, ASPECT, 0.3, 200)
    vc.position.copy(V)
    vc.lookAt(new THREE.Vector3(...KEY.look))
    vc.updateMatrixWorld(true)
    vc.updateProjectionMatrix()
    vp.multiplyMatrices(vc.projectionMatrix, vc.matrixWorldInverse)
    const uni = {
      uVP: { value: vp },
      uMask: { value: buildMask() },
      uRect: { value: new THREE.Vector4(CX, CY, HW, HH) },
      uAlign: { value: 0 },
      uSplit: { value: 0 },
    }
    const mat = new THREE.MeshStandardMaterial({ color: '#c9c8bd', roughness: 0.82, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAW = (modelMatrix * vec4(position, 1.0)).xyz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vAW;
uniform mat4 uVP; uniform sampler2D uMask; uniform vec4 uRect; uniform float uAlign; uniform float uSplit;
float ah(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float an(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(ah(i), ah(i+vec2(1,0)), f.x), mix(ah(i+vec2(0,1)), ah(i+vec2(1,1)), f.x), f.y); }
vec3 aMask(vec3 wp, float off) {
  vec4 c = uVP * vec4(wp, 1.0);
  if (c.w < 0.1) return vec3(0.0);
  vec2 ndc = c.xy / c.w;
  vec2 uv = (ndc - uRect.xy) / uRect.zw * 0.5 + 0.5;
  uv.x += off;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
  return vec3(texture2D(uMask, uv).r);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float mr = aMask(vAW, -uSplit).r, mg = aMask(vAW, 0.0).r, mb = aMask(vAW, uSplit).r;
  float m = mg;
  // road paint: worn through by traffic in the middle, broken by the asphalt's grain
  float grain = an(vAW.xz * 22.0) * 0.55 + an(vAW.xz * 71.0) * 0.45;
  float wear = 0.75 - 0.35 * exp(-vAW.x * vAW.x * 0.6) * an(vAW.xz * vec2(3.0, 0.6));
  float cover = smoothstep(0.22, 0.62, grain + wear - 0.55);
  diffuseColor.a = m * cover * 0.6;
  diffuseColor.rgb *= 0.9 + 0.2 * grain;
  uRGBm = vec3(mr, mg, mb);
}`)
        .replace('void main() {', 'vec3 uRGBm;\nvoid main() {')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * uAlign * 0.10 + vec3(uRGBm.r - uRGBm.g, 0.0, uRGBm.b - uRGBm.g) * (uSplit * 160.0) * 0.12;`)
    }
    mat.customProgramCacheKey = () => 'anamorph1'
    const geo = new THREE.PlaneGeometry(4.6, 20)
    geo.rotateX(-Math.PI / 2)
    return { mat, geo, uni }
  }, [])
  useEffect(() => () => { kit.mat.dispose(); kit.geo.dispose(); kit.uni.uMask.value.dispose() }, [kit])

  const tmp = useMemo(() => ({ f: new THREE.Vector3() }), [])
  useFrame(({ camera }, dt) => {
    if (rt.world !== 'alley') return
    // alignment = how close the live camera is to the virtual one (position AND direction)
    const d = camera.position.distanceTo(V)
    camera.getWorldDirection(tmp.f)
    const ang = Math.acos(Math.min(1, Math.max(-1, tmp.f.dot(VFWD))))
    const a = (1 - smoothstep(0.35, 1.5, d)) * (1 - smoothstep(0.05, 0.22, ang))
    align.current += (a - align.current) * Math.min(1, dt * 4)
    const A = align.current
    kit.uni.uAlign.value = A
    // a hair of colour separation, only when almost exactly aligned — and a post whisper to match
    kit.uni.uSplit.value = 0.0018 * smoothstep(0.75, 1, A)
    if (A > 0.8) rt.impulse.rgb = Math.max(rt.impulse.rgb, 0.0028 * smoothstep(0.8, 1, A))
    if (A > 0.9 && rt.time - lastCue.current > 40) {
      lastCue.current = rt.time
      audio.shimmer()
      useStore.getState().markEgg('anamorph')
    }
  })

  return <mesh geometry={kit.geo} material={kit.mat} position={[0, 0.013, -21]} renderOrder={3} />
}
