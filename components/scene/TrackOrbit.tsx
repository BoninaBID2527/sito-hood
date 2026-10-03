'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { alterco } from '@/data/project'
import { rt } from '@/lib/runtime'
import { useStore, TRACK_COUNT } from '@/lib/store'
import { selectTrack } from '@/lib/actions'
import { clamp, damp, smoothstep, wrapPi } from '@/lib/math'
import { WORLD, zoneT } from '@/lib/timeline'
import { palette } from '@/lib/timeOfDay'
import { createCardMaterial } from './TrackCard3D'
import { SPECS, TrackObject, useObjectMats, CARD_H as OBJ_H } from './TrackObjects'
import { streetMat } from './street/materials'

const SLOT = (Math.PI * 2) / TRACK_COUNT
const CARD_W = 2.15
const CARD_H = 3.0
const TILT = 0.2

const _f = new THREE.Vector3()
const _r = new THREE.Vector3()
const _u = new THREE.Vector3()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _e = new THREE.Euler()
const _w = new THREE.Vector3()
const _w2 = new THREE.Vector3()
const _dn = new THREE.Vector3(0, -1, 0)
const CARD_W_HALF = 1.075

/**
 * Seven real 3D cards on a tilted elliptical orbit around the artwork.
 * Scroll drives the orbit angle (via the camera spring), drag adds inertial momentum,
 * and idle time gently snaps the nearest card to the front.
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
  // overhead truss ring + the wires every object hangs from + a light shaft per object
  const rig = useMemo(() => {
    const ringMat = streetMat({ color: '#202226', roughness: 0.4, metalness: 0.85, aoBase: 0.95, macro: 0.3 })
    const ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 96)
    const ring2Geo = new THREE.TorusGeometry(1, 0.025, 6, 96)
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
    return { ringMat, ringGeo, ring2Geo, wireGeo, wireMat, coneGeo, coneMat, cones, lampGeo, lampMat }
  }, [])
  const ringRef = useRef<THREE.Group>(null)
  const coneRefs = useRef<(THREE.Mesh | null)[]>([])

  const ph = useRef({
    angle: 0,
    vel: 0,
    drag: 0,
    dragVel: 0,
    dragging: false,
    moved: 0,
    lastDrag: -10,
    justDragged: 0,
    hover: -1,
    hoverSm: new Array(TRACK_COUNT).fill(0),
    focus: new Array(TRACK_COUNT).fill(0),
    selAmt: 0,
    sheen: new THREE.Vector2(0.5, 0.5),
    snapIdx: 0,
  })

  // drag / swipe on the canvas
  useEffect(() => {
    const el = gl.domElement
    let lastX = 0
    let lastT = 0
    const inZone = () => rt.world === 'alley' && rt.smooth > 0.3 && rt.smooth < 0.66 && useStore.getState().selected === null && useStore.getState().mode === 'alterco'
    const down = (e: PointerEvent) => {
      if (!inZone()) return
      ph.current.dragging = true
      ph.current.moved = 0
      lastX = e.clientX
      lastT = performance.now()
      ph.current.dragVel = 0
    }
    const move = (e: PointerEvent) => {
      const p = ph.current
      if (!p.dragging) return
      const dx = e.clientX - lastX
      const now = performance.now()
      const dt = Math.max(1, now - lastT) / 1000
      lastX = e.clientX
      lastT = now
      p.moved += Math.abs(dx)
      // horizontal drag rotates the universe (angle per px scales with viewport width)
      const k = (Math.PI * 1.6) / Math.max(600, rt.width)
      p.drag += dx * k
      p.dragVel = damp(p.dragVel, (dx * k) / dt, 18, 0.016)
      p.lastDrag = rt.time
      if (p.moved > 6) useStore.getState().setCursor('drag', 'DRAG')
    }
    const up = () => {
      const p = ph.current
      if (!p.dragging) return
      p.dragging = false
      p.lastDrag = rt.time
      p.justDragged = p.moved > 6 ? rt.time : 0
      p.dragVel = clamp(p.dragVel, -5, 5)
      if (useStore.getState().cursor.kind === 'drag') useStore.getState().setCursor('default')
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose())
      geo.dispose()
      pool.dispose()
      poolGeo.dispose()
      twinMat.dispose(); glassMat.dispose()
      rig.ringMat.dispose(); rig.ringGeo.dispose(); rig.ring2Geo.dispose(); rig.wireGeo.dispose(); rig.wireMat.dispose(); rig.coneGeo.dispose(); rig.coneMat.dispose(); rig.cones.forEach((c) => c.dispose()); rig.lampGeo.dispose(); rig.lampMat.dispose()
    },
    [mats, geo, pool, poolGeo, twinMat, glassMat, rig],
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
    const ph_ = ph.current
    if (rt.orbit.resetDrag) {
      ph_.drag = 0
      ph_.dragVel = 0
      rt.orbit.resetDrag = false
    }
    const aspect = rt.aspect
    const rs = 0.5 + 0.5 * smoothstep(0.5, 1.4, aspect)

    // ── angular physics
    const zt = zoneT(p)
    const scrollAngle = -zt * (TRACK_COUNT - 1) * SLOT
    if (!ph_.dragging) {
      ph_.drag += ph_.dragVel * dt
      ph_.dragVel *= Math.exp(-3.4 * dt)
    }
    const total = scrollAngle + ph_.drag
    const idle = Math.min(rt.idle, rt.time - ph_.lastDrag)
    const snapW = ph_.dragging ? 0 : smoothstep(0.1, 0.55, idle) * (1 - smoothstep(0.5, 2.5, Math.abs(ph_.dragVel)))
    // hysteresis: only re-pick the nearest slot once we are clearly closer to another one
    const tIdx = total / SLOT
    if (Math.abs(tIdx - ph_.snapIdx) > 0.62) ph_.snapIdx = Math.round(tIdx)
    const snapped = ph_.snapIdx * SLOT
    let target = total + (snapped - total) * snapW
    if (st.selected !== null) {
      // park the ring with the selected card nearest the front (shortest way round)
      const want = -st.selected * SLOT
      const k = Math.round((ph_.angle - want) / (Math.PI * 2))
      target = want + k * Math.PI * 2
    }
    const err = target - ph_.angle
    rt.orbit.err = err
    const steps = Math.max(1, Math.ceil(dt / 0.008))
    for (let k = 0; k < steps; k++) {
      const h = dt / steps
      ph_.vel += ((target - ph_.angle) * 58 - ph_.vel * 11) * h
      ph_.vel = clamp(ph_.vel, -6.5, 6.5) // never uncontrolled spinning
      ph_.angle += ph_.vel * h
    }
    rt.orbit.angle = ph_.angle
    rt.orbit.drag = ph_.drag
    rt.orbit.vel = ph_.vel

    const front = ((Math.round(-ph_.angle / SLOT) % TRACK_COUNT) + TRACK_COUNT) % TRACK_COUNT
    if (front !== st.front) useStore.getState().set({ front })
    rt.orbit.front = front

    // ── assemble / recede
    const appear = smoothstep(0.3, 0.4, p)
    const recede = smoothstep(0.6, 0.665, p)
    const expand = recede * 1.1

    // ── camera basis for the focus pose
    camera.updateMatrixWorld()
    _r.setFromMatrixColumn(camera.matrixWorld, 0)
    _u.setFromMatrixColumn(camera.matrixWorld, 1)
    _f.setFromMatrixColumn(camera.matrixWorld, 2).negate()
    const dist = aspect > 1.2 ? 5.2 : 6.6
    const offX = aspect > 1.2 ? 1.55 : 0
    const offY = aspect > 1.2 ? 0 : 0.7

    ph_.selAmt = damp(ph_.selAmt, st.selected !== null ? 1 : 0, 4, dt)
    rt.orbit.sel = ph_.selAmt
    rt.orbit.selIdx = st.selected ?? rt.orbit.selIdx
    const C = WORLD.plazaCenter
    const Rx = 6.7 * rs * (1 + expand * 0.6)
    const Rz = 5.1 * rs * (1 + expand * 0.6)
    const cs = aspect < 1 ? 1.2 - 0.2 * smoothstep(0.5, 1, aspect) : 1 // bigger cards on portrait screens
    const hovered = ph_.hover

    for (let i = 0; i < TRACK_COUNT; i++) {
      const grp = cardRefs.current[i]
      if (!grp) continue
      const m = mats[i]
      // hover repels neighbours
      ph_.hoverSm[i] = damp(ph_.hoverSm[i], hovered === i && st.selected === null ? 1 : 0, 9, dt)
      let theta = i * SLOT + ph_.angle
      if (hovered >= 0 && hovered !== i && st.selected === null) {
        const d = wrapPi((i - hovered) * SLOT)
        theta += Math.sign(d) * 0.17 * Math.exp(-Math.abs(d) * 1.1)
      }
      const sp = SPECS[i]
      const x = Math.sin(theta) * Rx * sp.rad
      const zl = Math.cos(theta) * Rz * sp.rad
      const y = C.y - zl * Math.sin(TILT) + Math.sin(rt.time * 0.7 + i * 1.3) * 0.05 * (rt.reducedMotion ? 0 : 1) - 0.1 + sp.dy
      const z = C.z + zl * Math.cos(TILT)
      const far = (1 - Math.cos(theta)) / 2
      // the object at the front steps toward the viewer, the others stay back (focus by depth, not by UI chrome)
      const wF = smoothstep(0.55, 1.0, Math.cos(theta)) * (1 - recede) * (st.selected === null ? 1 : 0)
      _p.set(C.x + x, y, z + wF * 1.25)
      _p.y += wF * 0.06

      // hover: lean toward the camera
      const h = ph_.hoverSm[i]
      if (h > 0.001) {
        _f.set(0, 0, 0)
        _p.z += h * 0.85
        _p.y += h * 0.1
      }
      _f.setFromMatrixColumn(camera.matrixWorld, 2).negate()

      // base orientation: face outward, softened so side cards stay readable
      _e.set(sp.rx, wrapPi(theta) * 0.5 + sp.ry * (1 - wF), sp.rz + Math.sin(i * 2.1) * 0.03)
      _q.setFromEuler(_e)
      let scale = cs * (1 + h * 0.06 + wF * 0.08) * sp.s

      // focus pose
      const isSel = st.selected === i
      ph_.focus[i] = damp(ph_.focus[i], isSel ? 1 : 0, 4.2, dt)
      const e = ph_.focus[i]
      if (e > 0.001) {
        const fx = camera.position.x + _f.x * dist + _r.x * offX + _u.x * offY
        const fy = camera.position.y + _f.y * dist + _r.y * offX + _u.y * offY
        const fz = camera.position.z + _f.z * dist + _r.z * offX + _u.z * offY
        const ease = e * e * (3 - 2 * e)
        _p.lerp(new THREE.Vector3(fx, fy, fz), ease)
        _q2.copy(camera.quaternion)
        _e.set(rt.py * -0.05, rt.px * 0.08, 0)
        _q2.multiply(new THREE.Quaternion().setFromEuler(_e))
        _q.slerp(_q2, ease)
        scale = THREE.MathUtils.lerp(scale, (aspect > 1.2 ? 1.12 : 0.95) * cs, ease)
      } else if (ph_.selAmt > 0.001) {
        // other cards fall back
        _p.x = THREE.MathUtils.lerp(_p.x, C.x + x * 1.25, ph_.selAmt)
        _p.z -= ph_.selAmt * 2.2
        scale *= 1 - ph_.selAmt * 0.12
      }

      // appear scale
      scale *= 0.85 + 0.15 * appear
      grp.position.copy(_p)
      grp.quaternion.copy(_q)
      grp.scale.setScalar(scale)

      const u = m.uniforms
      u.uTime.value = rt.time
      u.uHover.value = isSel ? 0.9 : h
      u.uFar.value = isSel ? 0 : far * (1 - ph_.selAmt * 0.0) * (1 - e)
      // hierarchy: the front object owns the frame, everything else stays present but quieter
      u.uDim.value = isSel ? 0 : ph_.selAmt * 0.9 + recede * 0.7 + (1 - wF) * 0.16 * (1 - ph_.selAmt)
      u.uRgb.value = clamp(Math.abs(ph_.vel) * 0.0012, 0, 0.012) + rt.fx.contam * 0.002 + h * 0.0015
      u.uBend.value = clamp(ph_.vel * 0.12, -1, 1)
      u.uLit.value = sp.lit * (0.45 + palette.lamps * 0.6) * (0.6 + wF * 0.8)
      if (i === 1) objMats.lightbox.emissiveIntensity = 0.035 * (0.4 + palette.lamps) * (0.5 + wF)
      if (sp.twin) {
        const tu = twinMat.uniforms
        tu.uTime.value = rt.time; tu.uHover.value = u.uHover.value; tu.uFar.value = u.uFar.value; tu.uDim.value = u.uDim.value + 0.25; tu.uBend.value = u.uBend.value
        tu.uAppear.value = u.uAppear.value; tu.uFog.value.copy(palette.fog); tu.uRgb.value = u.uRgb.value + 0.003
      }
      u.uAppear.value = clamp(appear * 1.2 - i * 0.02, 0, 1) * (1 - recede * 0.3)
      u.uFog.value.copy(palette.fog)
      ph_.sheen.set(clamp(rt.px * 0.5 + 0.5), clamp(rt.py * 0.5 + 0.5))
      u.uSheen.value.copy(ph_.sheen)
      grp.renderOrder = isSel ? 20 : Math.round((1 - far) * 10)
      grp.visible = u.uAppear.value > 0.01
      // wires up to the truss ring (anchor sits on the ring at this object's angle → slightly slanted, never parallel)
      const wp = rig.wireGeo.attributes.position as THREE.BufferAttribute
      const ringY = C.y + 4.3
      const ax = C.x + Math.sin(theta) * Rx, az = C.z + Math.cos(theta) * Rz
      for (let k = 0; k < 2; k++) {
        const lx = (k ? 1 : -1) * CARD_W_HALF * 0.82
        _w.set(lx, OBJ_H / 2 + 0.05, 0).multiplyScalar(scale).applyQuaternion(_q).add(_p)
        wp.setXYZ(i * 4 + k * 2, _w.x, _w.y, _w.z)
        wp.setXYZ(i * 4 + k * 2 + 1, ax + (k ? 0.5 : -0.5) * 0.4, ringY, az)
      }
      const cone = coneRefs.current[i]
      if (cone) {
        const cu = rig.cones[i].uniforms
        cu.uI.value = (0.15 + wF * 0.85) * appear * (1 - recede) * (0.5 + palette.lamps * 0.5) * (st.selected === null ? 1 : 0.2)
        cone.visible = cu.uI.value > 0.01
        _w.set(ax, ringY, az)
        cone.position.copy(_w)
        _w2.copy(_p).sub(_w)
        const len = _w2.length()
        cone.scale.set(0.55 + len * 0.16, len, 0.55 + len * 0.16)
        _q2.setFromUnitVectors(_dn, _w2.normalize())
        cone.quaternion.copy(_q2)
      }
    }
    rig.wireGeo.attributes.position.needsUpdate = true
    rig.wireGeo.computeBoundingSphere()
    if (ringRef.current) {
      const rg = ringRef.current
      rg.position.set(C.x, C.y + 4.3, C.z)
      rg.rotation.y = ph_.angle * 0.35
      rg.scale.set(Rx, 1, Rz)
      rg.visible = appear > 0.02
    }
    // pool of light on the wet ground under the orbit
    pool.opacity = appear * (1 - recede * 0.7) * (0.12 + palette.lamps * 0.1)
    // the track in front tints the light it stands in — the wet plaza answers a little differently for each of them
    _tint.set(TRACK_TINT[((front % 7) + 7) % 7])
    pool.color.lerp(_tint, Math.min(1, dt * 1.6))
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
                e.stopPropagation()
                ph.current.hover = i
                useStore.getState().setCursor('track', 'VIEW')
              },
              onPointerOut: () => {
                if (ph.current.hover === i) ph.current.hover = -1
                if (useStore.getState().cursor.kind === 'track') useStore.getState().setCursor('default')
              },
              onClick: (e: any) => {
                e.stopPropagation()
                if (rt.time - ph.current.justDragged < 0.25 || ph.current.moved > 6) return
                if (useStore.getState().selected === i) return
                selectTrack(i)
              },
            }}
          />
        </group>
      ))}
      <group ref={ringRef} visible={false}>
        <mesh geometry={rig.ringGeo} material={rig.ringMat} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={rig.ring2Geo} material={rig.ringMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} scale={[0.985, 0.985, 1]} />
        {Array.from({ length: 10 }, (_, k) => {
          const a = (k / 10) * Math.PI * 2
          return <mesh key={k} geometry={rig.lampGeo} material={rig.lampMat} position={[Math.sin(a), -0.17, Math.cos(a)]} scale={[1 / 6.7, 1, 1 / 5.1]} />
        })}
      </group>
      <lineSegments geometry={rig.wireGeo} material={rig.wireMat} frustumCulled={false} />
      {alterco.tracks.map((tr, i) => (
        <mesh key={'sh' + tr.id} ref={(r) => { coneRefs.current[i] = r }} geometry={rig.coneGeo} material={rig.cones[i]} frustumCulled={false} renderOrder={4} />
      ))}
      <mesh geometry={poolGeo} material={pool} position={[C.x, 0.035, C.z + 1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />
    </group>
  )
}
