'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { rt } from '@/lib/runtime'
import { clamp, damp, smoothstep } from '@/lib/math'
import { CP, WORLD } from '@/lib/timeline'
import { createArtworkMaterial, createTileMaterial } from './ArtworkMaterial'
import { streetMat } from './street/materials'
import { palette } from '@/lib/timeOfDay'
import { useStore } from '@/lib/store'

/**
 * The official ALTERCO artwork as a physical object: a thin sleeve with a shader that
 * lets it dissolve out of the fog, drift like water and split RGB — never distorting it beyond recognition.
 */
export function AltercoArtwork({ mode, position, size = 4.5 }: { mode: 'plaza' | 'final'; position?: [number, number, number]; size?: number }) {
  const group = useRef<THREE.Group>(null)
  const front = useMemo(() => createArtworkMaterial(A.covers.alterco), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.8 }), [])
  // seen from behind the print glows through its stock (back-lit physical print), so the artwork still reads from every side of the installation
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: A.covers.alterco, color: '#8c8c8c', roughness: 0.9, emissive: new THREE.Color('#ffffff'), emissiveMap: A.covers.alterco, emissiveIntensity: 0.32 }), [])
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 0.045), [])
  const tilt = useRef({ x: 0, y: 0 })
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: A.glow, color: mode === 'final' ? '#9ab4ff' : '#ffb27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }), [mode])

  // plaza only: fragment assembly + the physical installation (frame, legs, uplights)
  const N = 8
  const tiles = useMemo(() => {
    if (mode !== 'plaza') return null
    const g = new THREE.PlaneGeometry(1 / N, 1 / N)
    const rnd = new Float32Array(N * N * 3), tl = new Float32Array(N * N * 2)
    const mat = createTileMaterial(A.covers.alterco, N)
    const im = new THREE.InstancedMesh(g, mat, N * N)
    const m4 = new THREE.Matrix4()
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c
      m4.makeTranslation((c + 0.5) / N - 0.5, (r + 0.5) / N - 0.5, 0)
      im.setMatrixAt(i, m4)
      rnd.set([Math.random(), Math.random(), Math.random()], i * 3)
      tl.set([c, r], i * 2)
    }
    // deterministic scatter (no per-load randomness drift): seed from index
    for (let i = 0; i < N * N; i++) { const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.678, c = Math.sin(i * 39.346) * 9876.54; rnd.set([a - Math.floor(a), b - Math.floor(b), c - Math.floor(c)], i * 3) }
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 3))
    g.setAttribute('aTile', new THREE.InstancedBufferAttribute(tl, 2))
    im.frustumCulled = false
    im.renderOrder = 3
    return { im, g, mat }
  }, [mode])
  const rig = useMemo(() => {
    if (mode !== 'plaza') return null
    const steel = streetMat({ color: '#1b1c20', roughness: 0.42, metalness: 0.85, aoBase: 0.9, macro: 0.5 })
    const plate = streetMat({ color: '#0f1013', roughness: 0.7, metalness: 0.3, aoBase: 0.9, macro: 0.5 })
    const box = new THREE.BoxGeometry(1, 1, 1)
    const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.5) })
    const lensGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16)
    const coneGeo = new THREE.ConeGeometry(1, 1, 24, 1, true)
    coneGeo.translate(0, -0.5, 0)
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uI: { value: 0 }, uC: { value: new THREE.Color('#ffe0b8') } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vN = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uI; uniform vec3 uC; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.7); float h = smoothstep(-1.0, -0.02, vY); gl_FragColor = vec4(uC, uI * f * (0.1 + 0.9 * h) * 0.16); }',
    })
    return { steel, plate, box, lens, lensGeo, coneGeo, coneMat }
  }, [mode])
  const rigRef = useRef<THREE.Group>(null)
  const parts = useRef<Record<string, THREE.Object3D | null>>({})
  const coneRefs = useRef<(THREE.Mesh | null)[]>([])
  const _v = useMemo(() => new THREE.Vector3(), [])
  const _t = useMemo(() => new THREE.Vector3(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _dn = useMemo(() => new THREE.Vector3(0, -1, 0), [])
  const _d = useMemo(() => new THREE.Vector3(), [])

  useEffect(
    () => () => {
      front.dispose(); dark.dispose(); back.dispose(); geo.dispose(); halo.dispose()
      if (tiles) { tiles.im.dispose(); tiles.g.dispose(); tiles.mat.dispose() }
      if (rig) { rig.steel.dispose(); rig.plate.dispose(); rig.box.dispose(); rig.lens.dispose(); rig.lensGeo.dispose(); rig.coneGeo.dispose(); rig.coneMat.dispose() }
    },
    [front, dark, back, geo, halo, tiles, rig],
  )

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const p = rt.smooth
    const u = front.uniforms
    u.uTime.value = rt.time
    u.uGrain.value = 0.8 + rt.fx.contam
    tilt.current.x = damp(tilt.current.x, rt.px, 2.5, dt)
    tilt.current.y = damp(tilt.current.y, rt.py, 2.5, dt)
    u.uTilt.value.set(tilt.current.x, tilt.current.y)
    const S = rt.reducedMotion ? 0 : 1

    if (mode === 'plaza') {
      // emerges from the fog as the orbit assembles, then swells at the ALTERCO reveal
      const reveal = smoothstep(CP.tracksStart - 0.06, CP.tracksStart + 0.07, p)
      const swell = smoothstep(0.58, CP.reveal + 0.02, p)
      // the anticipation ladder: scattered fragments + reflections (0 → .6) → tiles lock together (→ .9) → the sleeve itself
      const asm = smoothstep(0.255, CP.tracksStart + 0.04, p)
      const whole = smoothstep(0.86, 1.0, asm)
      u.uReveal.value = whole
      u.uFlow.value = 0.25 + swell * 1.3 + rt.fx.contam * 0.6
      u.uSplit.value = 0.0015 + swell * 0.01 + rt.fx.contam * 0.004
      u.uGlow.value = 0.3 + swell
      u.uBulge.value = 1 + swell * 3
      const s = size * (1 + swell * 0.55)
      const py = WORLD.plazaCenter.y + Math.sin(rt.time * 0.6) * 0.06 * S - swell * 0.2
      g.scale.set(s, s, 1)
      g.position.set(WORLD.plazaCenter.x, py, WORLD.plazaCenter.z)
      g.rotation.set(-tilt.current.y * 0.07 * S, tilt.current.x * 0.12 * S + Math.sin(rt.time * 0.3) * 0.03 * S, 0)
      halo.opacity = whole * (0.1 + swell * 0.3)
      const on = rt.world === 'alley' && p > 0.24 && p < 0.74
      g.visible = on && whole > 0.01
      if (tiles) {
        const tu = tiles.mat.uniforms
        tu.uAsm.value = asm; tu.uTime.value = rt.time; tu.uSplit.value = u.uSplit.value; tu.uFlow.value = u.uFlow.value; tu.uGlow.value = u.uGlow.value
        tiles.im.visible = on && asm > 0.01 && whole < 0.995
        tiles.im.position.copy(g.position)
        tiles.im.rotation.copy(g.rotation)
        tiles.im.scale.set(s, s, 1)
      }
      // installation hardware (frame, legs, uplights) locks in as the fragments do
      const rg = rigRef.current
      if (rg && rig) {
        const vis = on && asm > 0.5
        rg.visible = vis
        if (vis) {
          const k = smoothstep(0.5, 0.95, asm)
          const half = s / 2, z0 = WORLD.plazaCenter.z
          const setP = (key: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
            const o = parts.current[key]
            if (o) { o.position.set(x, y, z); o.scale.set(sx, Math.max(0.0001, sy), sz) }
          }
          setP('top', 0, py + half + 0.08, z0 - 0.07, (s + 0.34) * k, 0.15, 0.3)
          setP('bot', 0, py - half - 0.08, z0 - 0.07, (s + 0.34) * k, 0.15, 0.3)
          setP('l', -half - 0.08, py, z0 - 0.07, 0.15, s * k, 0.3)
          setP('r', half + 0.08, py, z0 - 0.07, 0.15, s * k, 0.3)
          setP('back', 0, py, z0 - 0.2, s + 0.12, s + 0.12, 0.08)
          const legH = Math.max(0, py - half - 0.16)
          for (const [key, sx] of [['legL', -1], ['legR', 1]] as const) setP(key, sx * half * 0.62, legH / 2, z0 - 0.42, 0.14, legH * k, 0.14)
          for (const [key, sx] of [['padL', -1], ['padR', 1]] as const) setP(key, sx * half * 0.62, 0.04, z0 - 0.42, 0.7, 0.08, 0.7)
          setP('brace', 0, Math.max(0.5, py - half - 0.9), z0 - 0.42, half * 1.24 + 0.14, 0.09, 0.09)
          // uplights on the wet ground in front, aimed at the lower third of the sleeve
          const ci = rig.coneMat.uniforms
          ci.uI.value = k * (0.45 + palette.lamps * 0.55) * (1 - smoothstep(0.58, 0.66, p))
          for (let i = 0; i < 4; i++) {
            const x = (i - 1.5) * Math.min(1.5, half * 0.55)
            _v.set(x, 0.16, z0 + 2.1 + (i % 2) * 0.35)
            setP('lamp' + i, _v.x, _v.y, _v.z, 0.46, 0.2, 0.34)
            const lampObj = parts.current['lens' + i]
            if (lampObj) { lampObj.position.set(_v.x, _v.y + 0.12, _v.z - 0.05); lampObj.rotation.set(-0.7, 0, 0) }
            const cone = coneRefs.current[i]
            if (cone) {
              _t.set(x * 0.6, py - half * 0.15, z0 - 0.05)
              const d = _d.copy(_t).sub(_v)
              const len = d.length()
              cone.position.copy(_v)
              cone.position.y += 0.16
              cone.scale.set(0.5 + len * 0.18, len * 0.98, 0.5 + len * 0.18)
              _q.setFromUnitVectors(_dn, d.normalize())
              cone.quaternion.copy(_q)
            }
          }
        }
      }
    } else {
      const sel = useStore.getState().visited.length === 7
      u.uReveal.value = smoothstep(0.8, 0.93, p)
      u.uFlow.value = 0.35 + rt.fx.contam
      u.uSplit.value = 0.0018 + rt.fx.contam * 0.004
      u.uGlow.value = sel ? 1.2 : 0.5
      u.uBulge.value = 1
      g.scale.set(size, size, 1)
      const [x, y, z] = position!
      // bolted to its frame: no float, only a breath of parallax
      g.position.set(x, y, z)
      g.rotation.set(0, -0.14, 0)
      halo.opacity = smoothstep(0.8, 0.95, p) * (0.2 + (sel ? 0.25 : 0))
      g.visible = rt.world === 'roof'
    }
    void clamp
  }, -0.5)

  return (
    <>
      <group ref={group}>
        <mesh geometry={geo} material={[dark, dark, dark, dark, front, back]} />
        <sprite material={halo} scale={[2.6, 2.6, 1]} position={[0, 0, -0.1]} />
      </group>
      {tiles && <primitive object={tiles.im} />}
      {rig && (
        <group ref={rigRef} visible={false}>
          {(['top', 'bot', 'l', 'r', 'legL', 'legR', 'brace'] as const).map((k) => (
            <mesh key={k} ref={(o) => { parts.current[k] = o }} geometry={rig.box} material={rig.steel} />
          ))}
          {(['padL', 'padR', 'back'] as const).map((k) => (
            <mesh key={k} ref={(o) => { parts.current[k] = o }} geometry={rig.box} material={rig.plate} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <group key={i}>
              <mesh ref={(o) => { parts.current['lamp' + i] = o }} geometry={rig.box} material={rig.steel} />
              <mesh ref={(o) => { parts.current['lens' + i] = o }} geometry={rig.lensGeo} material={rig.lens} />
              <mesh ref={(o) => { coneRefs.current[i] = o }} geometry={rig.coneGeo} material={rig.coneMat} frustumCulled={false} renderOrder={4} />
            </group>
          ))}
        </group>
      )}
    </>
  )
}
