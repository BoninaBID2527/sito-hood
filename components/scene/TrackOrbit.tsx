'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { alterco } from '@/data/project'
import { rt } from '@/lib/runtime'
import { useStore, TRACK_COUNT } from '@/lib/store'
import { selectTrack } from '@/lib/actions'
import { jumpToTrack } from '@/lib/nav'
import { clamp, smoothstep } from '@/lib/math'
import { WORLD } from '@/lib/timeline'
import { palette } from '@/lib/timeOfDay'
import { rig, installTrackInput } from '@/lib/trackRig'
import { STATIONS, TRUSS, railPoints } from '@/lib/installation'
import { GeoBuilder } from '@/lib/geo'
import { createCardMaterial } from './TrackCard3D'
import { SPECS, TrackObject, useObjectMats, CARD_H as OBJ_H } from './TrackObjects'
import { TrackTypography } from './TrackTypography'
import { NoReflect } from './street/NoReflect'
import { streetMat } from './street/materials'

const CARD_W = 2.15
const CARD_H = 3.0
const CARD_W_HALF = 1.075

const _p = new THREE.Vector3()
const _w = new THREE.Vector3()
const _w2 = new THREE.Vector3()
const _dn = new THREE.Vector3(0, -1, 0)
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _e = new THREE.Euler()

/**
 * THE ALTERCO TRACK INSTALLATION.
 * Seven objects hang around the official artwork at their own depths / heights / scales / angles (lib/installation.ts) from one
 * overhead truss. The camera (lib/trackRig.ts, placed by the Director) walks around the outside, one pose per track, so the
 * artwork is the shared background of every composition. Only the focused object and its neighbours are rendered at full cost.
 * Typography lives in the space around each object (TrackTypography).
 */
const TRACK_TINT = ['#ffb070', '#8ab4ff', '#e8dcc0', '#ff8068', '#8fffd8', '#c498ff', '#ffe49a']
const _tint = new THREE.Color()

export function TrackOrbit() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const root = useRef<THREE.Group>(null)
  const cardRefs = useRef<(THREE.Group | null)[]>([])
  const mats = useMemo(() => A.cards.map((t) => createCardMaterial(t)), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(CARD_W, CARD_H, 10, 14), [])
  const pool = useMemo(
    () => new THREE.MeshBasicMaterial({ map: A.glow, color: new THREE.Color('#ffb070'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    [],
  )
  const poolGeo = useMemo(() => new THREE.PlaneGeometry(16, 16), [])
  const objMats = useObjectMats()
  const twinMat = useMemo(() => { const m = createCardMaterial(A.cards[5]); m.uniforms.uNeg.value = 1; return m }, [])
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a8c8d8', transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }), [])
  // overhead truss (an ellipse over the whole installation) + the wires every object hangs from + a light shaft per object
  const rigKit = useMemo(() => {
    const ringMat = streetMat({ color: '#202226', roughness: 0.4, metalness: 0.85, aoBase: 0.95, macro: 0.3 })
    const ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 112)
    const ring2Geo = new THREE.TorusGeometry(1, 0.025, 6, 112)
    const wireGeo = new THREE.BufferGeometry()
    wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACK_COUNT * 4 * 3), 3))
    const wireMat = new THREE.LineBasicMaterial({ color: '#0b0b0d' })
    const coneGeo = new THREE.ConeGeometry(1, 1, 24, 1, true)
    coneGeo.translate(0, -0.5, 0)
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uI: { value: 0 }, uC: { value: new THREE.Color('#ffd8a8') } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vN = normalMatrix*normal; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uI; uniform vec3 uC; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.8); float h = smoothstep(-1.0, -0.05, vY); gl_FragColor = vec4(uC, uI * f * (0.25 + 0.75 * h) * 0.14); }',
    })
    const cones = Array.from({ length: TRACK_COUNT }, () => coneMat.clone())
    const lampGeo = new THREE.SphereGeometry(0.09, 8, 6)
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 1.5) })
    // foreground poles: they stand just inside the camera's path, so between two tracks one slides past the lens (depth punctuation)
    const poles = new GeoBuilder()
    railPoints(6).forEach(({ p, side }, k) => {
      const dd = 1.05 + (k % 3) * 0.12
      const x = p.x + side.x * dd, z = p.z + side.y * dd
      poles.cyl(0.032, 0.04, 9.0, x, 4.2, z, 8)
      poles.box(0.5, 0.05, 0.05, x, 3.2 + (k % 4) * 0.7, z, 0, k * 0.8, 0)
    })
    const poleGeo = poles.build()
    return { ringMat, ringGeo, ring2Geo, wireGeo, wireMat, coneGeo, coneMat, cones, lampGeo, lampMat, poleGeo }
  }, [])
  const ringRef = useRef<THREE.Group>(null)
  const coneRefs = useRef<(THREE.Mesh | null)[]>([])
  const poleRef = useRef<THREE.Mesh>(null)
  const hoverSm = useRef<number[]>(new Array(TRACK_COUNT).fill(0))
  const focusSm = useRef<number[]>(new Array(TRACK_COUNT).fill(0))
  const sheen = useRef(new THREE.Vector2(0.5, 0.5))
  // only the object in front is mirrored in the water (a second render of it); the others are drawn once
  const mirrored = useRef<boolean[]>(new Array(TRACK_COUNT).fill(true))
  useEffect(() => {
    cardRefs.current.forEach((g) => g?.traverse((o) => o.layers.set(1)))
    mirrored.current.fill(false)
  }, [])

  // drag / swipe on the canvas (horizontal intent only; vertical belongs to the page scroll)
  useEffect(() => installTrackInput(gl.domElement), [gl])

  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose())
      geo.dispose()
      pool.dispose()
      poolGeo.dispose()
      twinMat.dispose(); glassMat.dispose()
      rigKit.ringMat.dispose(); rigKit.ringGeo.dispose(); rigKit.ring2Geo.dispose(); rigKit.wireGeo.dispose(); rigKit.wireMat.dispose(); rigKit.coneGeo.dispose(); rigKit.coneMat.dispose(); rigKit.cones.forEach((c) => c.dispose()); rigKit.lampGeo.dispose(); rigKit.lampMat.dispose(); rigKit.poleGeo.dispose()
    },
    [mats, geo, pool, poolGeo, twinMat, glassMat, rigKit],
  )

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05) // never integrate a long hitch
    const g = root.current
    if (!g) return
    const p = rt.smooth
    const on = rt.world === 'alley' && p > 0.27 && p < 0.74
    if (g.visible !== on) g.visible = on
    if (!on) return
    const st = useStore.getState()
    const aspect = rt.aspect
    const portrait = aspect < 1
    const reach = 0.4 + 0.45 * rt.quality.trackReach // stations (each side) that still render at full cost (the rest cost nothing)

    const appear = smoothstep(0.3, 0.4, p)
    const recede = smoothstep(0.6, 0.665, p)
    const red = rt.reducedMotion ? 0 : 1
    const hovered = rig.hover
    const cs = portrait ? 1.2 - 0.2 * smoothstep(0.5, 1, aspect) : 1

    for (let i = 0; i < TRACK_COUNT; i++) {
      const grp = cardRefs.current[i]
      if (!grp) continue
      const S = STATIONS[i]
      const sp = SPECS[i]
      const d = Math.abs(rig.u - i)
      // proximity LOD: the focused object and its neighbours get the full treatment; the others fade out and stop costing
      const near = 1 - smoothstep(reach - 0.4, reach + 0.5, d)
      const wF = smoothstep(1.3, 0.0, d)
      const isSel = st.selected === i
      hoverSm.current[i] += ((hovered === i && st.selected === null && !rt.touch ? 1 : 0) - hoverSm.current[i]) * Math.min(1, dt * 9)
      focusSm.current[i] += ((isSel ? 1 : 0) - focusSm.current[i]) * Math.min(1, dt * 4.2)
      const h = hoverSm.current[i]
      const e = focusSm.current[i]

      const vis = appear * near
      const m = mats[i]
      const u = m.uniforms
      u.uAppear.value = clamp(vis * 1.2 - i * 0.02, 0, 1) * (1 - recede * 0.3)
      const show = u.uAppear.value > 0.02
      if (grp.visible !== show) grp.visible = show
      if (!show) continue
      const wantMirror = d < 0.85 && rt.quality.reflector
      if (wantMirror !== mirrored.current[i]) {
        mirrored.current[i] = wantMirror
        const layer = wantMirror ? 0 : 1
        grp.traverse((o) => o.layers.set(layer))
      }

      // position: the object's own spot, floating a hair; at the end of the walk the installation opens outward
      const open = recede * 2.6
      _p.set(S.pos.x + S.out.x * open, S.pos.y + Math.sin(rt.time * 0.7 + i * 1.3) * 0.045 * red + (i === 5 ? 0.1 : 0), S.pos.z + S.out.y * open)
      // hover: lean toward the viewer
      if (h > 0.001) { _p.x += (STATIONS[i].cam.x - S.pos.x) * 0.02 * h; _p.z += (STATIONS[i].cam.z - S.pos.z) * 0.02 * h }
      // orientation: faces its own camera; the near ones relax toward the lens a touch more
      _e.set(sp.rx, S.yaw + sp.ry * (1 - wF) + Math.sin(rt.time * 0.5 + i) * 0.012 * red + (i === 2 ? 0 : 0), sp.rz + Math.sin(i * 2.1) * 0.03)
      _q.setFromEuler(_e)
      // motion character: 03 is rigid (no sway), 05 loosens (a little slack), 07 settles
      const slack = i === 4 ? Math.sin(rt.time * 0.18) * 0.018 * wF * red : 0
      if (slack) { _e.set(0, 0, slack); _q2.setFromEuler(_e); _q.multiply(_q2) }
      const scale = cs * (1 + h * 0.05 + wF * 0.05 + (isSel ? 0.06 * e : 0)) * sp.s * (0.88 + 0.12 * appear)
      grp.position.copy(_p)
      grp.quaternion.copy(_q)
      grp.scale.setScalar(scale)

      u.uTime.value = rt.time
      u.uHover.value = isSel ? 0.9 : h
      u.uFar.value = (1 - wF) * 0.55 * (1 - e)
      // hierarchy: the object in front owns the frame, neighbours recede, the rest are dim
      const others = st.selected !== null && !isSel ? 0.85 : 0
      u.uDim.value = clamp((1 - wF) * 0.38 + others + recede * 0.5, 0, 0.95)
      u.uRgb.value = clamp(Math.abs(rig.vel) * 0.0016, 0, 0.012) + rt.fx.contam * 0.002 + h * 0.0015
      u.uBend.value = clamp(rig.vel * 0.12, -1, 1)
      u.uLit.value = sp.lit * (0.45 + palette.lamps * 0.6) * (0.55 + wF * 0.9)
      if (i === 1) objMats.lightbox.emissiveIntensity = 0.035 * (0.4 + palette.lamps) * (0.5 + wF)
      if (sp.twin) {
        const tu = twinMat.uniforms
        tu.uTime.value = rt.time; tu.uHover.value = u.uHover.value; tu.uFar.value = u.uFar.value; tu.uDim.value = u.uDim.value + 0.25; tu.uBend.value = u.uBend.value
        tu.uAppear.value = u.uAppear.value; tu.uFog.value.copy(palette.fog); tu.uRgb.value = u.uRgb.value + 0.003
      }
      u.uFog.value.copy(palette.fog)
      sheen.current.set(clamp(rt.px * 0.5 + 0.5), clamp(rt.py * 0.5 + 0.5))
      u.uSheen.value.copy(sheen.current)
      grp.renderOrder = isSel ? 20 : Math.round(wF * 10)

      // wires up to the truss (anchor = the ellipse point in this object's direction)
      const wp = rigKit.wireGeo.attributes.position as THREE.BufferAttribute
      const ang = Math.atan2((S.pos.x - TRUSS.cx) / TRUSS.rx, (S.pos.z - TRUSS.cz) / TRUSS.rz)
      const ax = TRUSS.cx + Math.sin(ang) * TRUSS.rx, az = TRUSS.cz + Math.cos(ang) * TRUSS.rz
      const top = OBJ_H / 2 * scale + 0.05
      for (let k = 0; k < 2; k++) {
        const lx = (k ? 1 : -1) * CARD_W_HALF * 0.82 * scale
        _w.set(lx, top, 0).applyQuaternion(_q).add(_p)
        wp.setXYZ(i * 4 + k * 2, _w.x, _w.y, _w.z)
        wp.setXYZ(i * 4 + k * 2 + 1, ax + (k ? 0.5 : -0.5) * 0.4, TRUSS.y, az)
      }
      const cone = coneRefs.current[i]
      if (cone) {
        const cu = rigKit.cones[i].uniforms
        // the light reorganises around the focused object; others keep a whisper
        cu.uI.value = (0.12 + wF * 0.88) * vis * (1 - recede) * (0.5 + palette.lamps * 0.5) * (st.selected === null ? 1 : isSel ? 1.2 : 0.2)
        cone.visible = cu.uI.value > 0.01
        _w.set(ax, TRUSS.y, az)
        cone.position.copy(_w)
        _w2.copy(_p).sub(_w)
        const len = _w2.length()
        cone.scale.set(0.55 + len * 0.16, len, 0.55 + len * 0.16)
        _q2.setFromUnitVectors(_dn, _w2.normalize())
        cone.quaternion.copy(_q2)
      }
    }
    rigKit.wireGeo.attributes.position.needsUpdate = true
    if (ringRef.current) {
      const rg = ringRef.current
      rg.position.set(TRUSS.cx, TRUSS.y, TRUSS.cz)
      rg.scale.set(TRUSS.rx, 1, TRUSS.rz)
      rg.visible = appear > 0.02
    }
    if (poleRef.current) poleRef.current.visible = rig.w > 0.02 && appear > 0.5
    // pool of light on the wet ground: it follows the front object's tint
    const C = WORLD.plazaCenter
    pool.opacity = appear * (1 - recede * 0.7) * (0.12 + palette.lamps * 0.1)
    _tint.set(TRACK_TINT[((rig.front % 7) + 7) % 7])
    pool.color.lerp(_tint, Math.min(1, dt * 1.6))
    void C
  }, -0.4)

  const C = WORLD.plazaCenter
  return (
    <group ref={root} visible={false}>
      {alterco.tracks.map((tr, i) => (
        <group key={tr.id} ref={(r) => { cardRefs.current[i] = r }}>
          <TrackObject
            i={i}
            faceGeo={geo}
            faceMat={mats[i]}
            mats={objMats}
            twinMat={SPECS[i].twin ? twinMat : null}
            glassMat={glassMat}
            onFace={{
              onPointerOver: (e: any) => {
                if (rt.touch || useStore.getState().selected !== null) return
                if (Math.abs(rig.u - i) > 1.3) return
                e.stopPropagation()
                rig.hover = i
                useStore.getState().setCursor('track', rig.front === i ? 'OPEN' : 'GO')
              },
              onPointerOut: () => {
                if (rig.hover === i) rig.hover = -1
                if (useStore.getState().cursor.kind === 'track') useStore.getState().setCursor('default')
              },
              onClick: (e: any) => {
                if (Math.abs(rig.u - i) > 1.8) return
                e.stopPropagation()
                if (rt.time - rig.justDragged < 0.25 || rig.moved > 6) return
                if (useStore.getState().selected === i) return
                // the camera travels to a track first; a second tap on the one in front opens it
                if (rig.front !== i && useStore.getState().selected === null) jumpToTrack(i)
                else selectTrack(i)
              },
            }}
          />
        </group>
      ))}
      <NoReflect><TrackTypography /></NoReflect>
      <NoReflect>
      <group ref={ringRef} visible={false}>
        <mesh geometry={rigKit.ringGeo} material={rigKit.ringMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={rigKit.ring2Geo} material={rigKit.ringMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} scale={[0.985, 0.985, 1]} />
        {Array.from({ length: 12 }, (_, k) => {
          const a = (k / 12) * Math.PI * 2
          return <mesh key={k} geometry={rigKit.lampGeo} material={rigKit.lampMat} position={[Math.sin(a), -0.17, Math.cos(a)]} scale={[1 / TRUSS.rx / 1, 1, 1 / TRUSS.rz / 1]} />
        })}
      </group>
      <mesh ref={poleRef} geometry={rigKit.poleGeo} material={objMats.metal} visible={false} />
      <lineSegments geometry={rigKit.wireGeo} material={rigKit.wireMat} frustumCulled={false} />
      {alterco.tracks.map((tr, i) => (
        <mesh key={'sh' + tr.id} ref={(r) => { coneRefs.current[i] = r }} geometry={rigKit.coneGeo} material={rigKit.cones[i]} frustumCulled={false} renderOrder={4} />
      ))}
      </NoReflect>
      <NoReflect><mesh geometry={poolGeo} material={pool} position={[C.x, 0.035, C.z + 1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} /></NoReflect>
    </group>
  )
}
