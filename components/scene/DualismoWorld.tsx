'use client'

import { useWorldFrame } from '@/hooks/useWorldFrame'
import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { A } from '@/lib/assets'
import { dualismo } from '@/data/project'
import { rng, smoothstep, clamp } from '@/lib/math'
import { rt } from '@/lib/runtime'
import { WORLD } from '@/lib/timeline'
import { useStore } from '@/lib/store'
import { exitDualism } from '@/lib/actions'
import { createArtworkMaterial } from './ArtworkMaterial'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  domeVert, domeFrag, monoVert, monoFrag, floorVert, floorFrag, ringVert, ringFrag, coinVert, coinFrag, bezelFrag,
  moteVert, moteFrag, shaftVert, shaftFrag, entryRingVert, entryRingFrag, doorFrag,
} from './DualismoShaders'

const D = WORLD.dualismX
const FLOOR_Y = -2.6

/* ─────────────────────────────────────────────────────────────────────────────────────────────
   DUALISMO — "the impossible hall" (V3.6 rebuild)

   Composition: one object matters. The official sleeve is inlaid in a levitating monolith of iron-glass over a black stone mirror;
   it is the only real emitter, so the glass nearest to it, the floor below it and the haze around it are lit BY it.
   Around it: an avenue of mirrored monoliths that grow and dissolve into the exact colour of the backdrop (near sharp, far gone),
   a vast ring on the horizon that the floor completes into a full circle, and a lot of empty darkness (scale = what is NOT there).
   Cost model: everything solid is opaque and writes depth (no stacked transparent glass). The transparent layers left are a few
   small, depth-sorted additive sheets (shafts, a halo, two labels, motes) and they are not drawn into the planar reflection (layer 1).
   ───────────────────────────────────────────────────────────────────────────────────────────── */

/** shared, frame-updated uniforms (the same objects are referenced by every material of the world) */
function makeShared() {
  return {
    uTime: { value: 0 },
    uFade: { value: 0 },
    uArtI: { value: 1 },
    uArt: { value: new THREE.Vector3(D, 0.9, 1.4) },
    uArtCol: { value: new THREE.Color(0.55, 0.62, 1.0) },
  }
}
type Shared = ReturnType<typeof makeShared>

/** viewport-dependent layout (16:9 desktop → portrait phone). 1 = wide, smaller = narrower. */
function fitFor(aspect: number) {
  return clamp(aspect / 1.78, 0.42, 1)
}

/** one-line exposure hook for the shared artwork shader (so a track token can be dimmed without editing the artwork material) */
function withExposure(m: THREE.ShaderMaterial, expo: number) {
  m.uniforms.uExpo = { value: expo }
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader
      .replace('uniform vec2 uTilt;', 'uniform vec2 uTilt;\nuniform float uExpo;')
      .replace('gl_FragColor = vec4(col * (1.0 + uGlow * 0.15), a);', 'gl_FragColor = vec4(col * (1.0 + uGlow * 0.15) * uExpo, a);')
  }
  m.customProgramCacheKey = () => 'dual-expo'
  return m
}

/** planar reflection throttle (same policy as the street: every N frames while moving, 4 Hz at rest) but with a far plane that keeps the gate */
function throttleDualReflector(r: THREE.Mesh) {
  const orig = (r as unknown as { onBeforeRender: (...a: unknown[]) => void }).onBeforeRender
  let n = 0
  let lastT = -10
  const lastP = new THREE.Vector3(1e9, 0, 0)
  const lastQ = new THREE.Quaternion()
  ;(r as unknown as { onBeforeRender: (...a: unknown[]) => void }).onBeforeRender = function (this: unknown, renderer: unknown, scene: unknown, camera: unknown, ...rest: unknown[]) {
    const cam = camera as THREE.PerspectiveCamera
    const every = Math.max(1, rt.quality.reflectEvery)
    const moved = cam.position.distanceToSquared(lastP) > 4e-6 || Math.abs(cam.quaternion.dot(lastQ)) < 0.9999995
    const age = rt.time - lastT
    n++
    if (!moved && age < 0.25) return
    if (moved && every > 1 && n % every !== 0 && age < 0.12) return
    lastP.copy(cam.position)
    lastQ.copy(cam.quaternion)
    lastT = rt.time
    const info = (renderer as THREE.WebGLRenderer).info
    const c0 = info.render.calls
    const far = cam.far
    cam.far = Math.min(far, 430)
    orig.call(this, renderer, scene, camera, ...rest)
    cam.far = far
    rt.stats.refl += info.render.calls - c0
  }
}

/* ───────────────────────── backdrop dome ───────────────────────── */

function Backdrop({ shared }: { shared: Shared }) {
  const kit = useMemo(() => {
    const geo = new THREE.SphereGeometry(380, 32, 16)
    const mat = new THREE.ShaderMaterial({
      vertexShader: domeVert, fragmentShader: domeFrag, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uFade: shared.uFade, uTime: shared.uTime },
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = -100
    mesh.frustumCulled = false
    return { geo, mat, mesh }
  }, [shared])
  const camera = useThree((s) => s.camera)
  useWorldFrame('dualism', () => { kit.mesh.position.copy(camera.position) }, -0.6)
  useEffect(() => () => { kit.geo.dispose(); kit.mat.dispose() }, [kit])
  return <primitive object={kit.mesh} />
}

/* ───────────────────────── black stone mirror ───────────────────────── */

function MirrorFloor({ shared }: { shared: Shared }) {
  const real = rt.quality.reflector
  const kit = useMemo(() => {
    const geo = new THREE.PlaneGeometry(900, 900)
    const uniforms = { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 }, uFade: { value: 0 }, uArtI: { value: 1 }, uArt: { value: new THREE.Vector3(D, 0.9, 1.4) }, uArtCol: { value: new THREE.Color(0.55, 0.62, 1.0) } }
    let obj: THREE.Mesh
    let mat: THREE.ShaderMaterial
    if (real) {
      const shader = { name: 'DualFloor', defines: { REAL: '' }, uniforms, vertexShader: floorVert, fragmentShader: floorFrag }
      const rf = new Reflector(geo, { color: new THREE.Color(1, 1, 1), textureWidth: rt.quality.reflectorRes, textureHeight: Math.round(rt.quality.reflectorRes * 0.62), clipBias: 0.003, multisample: rt.quality.level >= 2 ? 2 : 0, shader })
      throttleDualReflector(rf)
      mat = rf.material as THREE.ShaderMaterial
      mat.defines = { REAL: '' }
      obj = rf
    } else {
      mat = new THREE.ShaderMaterial({ vertexShader: floorVert, fragmentShader: floorFrag, uniforms })
      obj = new THREE.Mesh(geo, mat)
    }
    obj.rotation.x = -Math.PI / 2
    obj.position.set(D, FLOOR_Y, -60)
    obj.renderOrder = -1
    obj.frustumCulled = false
    return { obj, mat, geo }
  }, [real])
  useWorldFrame('dualism', () => {
    const u = kit.mat.uniforms
    u.uTime.value = shared.uTime.value
    u.uFade.value = shared.uFade.value
    u.uArtI.value = shared.uArtI.value
    u.uArt.value.copy(shared.uArt.value)
    u.uArtCol.value.copy(shared.uArtCol.value)
  }, -0.5)
  useEffect(() => () => { ;(kit.obj as unknown as { dispose?: () => void }).dispose?.(); kit.geo.dispose(); kit.mat.dispose() }, [kit])
  return <primitive object={kit.obj} />
}

/* ───────────────────────── monoliths: avenue + floating blades ───────────────────────── */

function Monoliths({ shared, fit }: { shared: Shared; fit: number }) {
  const kit = useMemo(() => {
    const q = rt.quality
    const rows = q.dualRows
    const pairs = Math.max(2, Math.round(q.dualCrystals * 0.5))
    const r = rng(1313)
    const geo = new RoundedBoxGeometry(1, 1, 1, q.level >= 2 ? 2 : 1, 0.1)
    const mat = new THREE.ShaderMaterial({
      vertexShader: monoVert, fragmentShader: monoFrag, fog: false,
      uniforms: { uTime: shared.uTime, uFade: shared.uFade, uArtI: shared.uArtI, uArt: shared.uArt, uArtCol: shared.uArtCol, uSheen: { value: 0 } },
    })
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3()
    // avenue: strictly mirrored pairs; size grows with depth so the rows keep an even angular rhythm and the far ones are towers
    const avenue = new THREE.InstancedMesh(geo, mat, rows * 2)
    const dim = new Float32Array(rows * 2 * 3), misc = new Float32Array(rows * 2 * 4)
    // sparse and large near the viewer, dense and dissolving far away: the six nearest rows are authored (they are the frame of the picture,
    // whatever the tier), the rest are spread logarithmically toward the horizon (their number is the tier knob)
    const NEAR = [16, 27, 44, 68, 100, 140], NEAR_ANG = [30, 24, 28, 22, 26, 23]
    for (let i = 0; i < rows; i++) {
      const far = i - NEAR.length
      const dist = i < NEAR.length ? NEAR[i] : 190 * Math.pow(470 / 190, far / Math.max(1, rows - NEAR.length - 1))
      const z = 9.5 - dist
      const ang = (i < NEAR.length ? NEAR_ANG[i] : r.range(20, 34)) * (Math.PI / 180)
      const x = Math.tan(ang) * dist * fit
      const w = 1.0 + dist * 0.028 * (0.7 + r() * 0.6), h = 18 + dist * 0.32 + r() * 8, d = 1.1 + dist * 0.02 + r() * 1.4
      const yaw = r.range(0.12, 0.55), cut = r() < 0.65 ? r.range(0.04, 0.16) : 0
      const lean = r.range(0.02, 0.07) // the hall leans in: the vault never closes
      const seed = r(), hover = i % 3 === 1 ? r.range(0.5, 1.6) : 0
      const bevel = Math.min(0.1 + dist * 0.004, w * 0.3)
      for (const sgn of [-1, 1]) {
        const k = i * 2 + (sgn > 0 ? 1 : 0)
        m4.compose(pv.set(D + sgn * x, FLOOR_Y + hover + h / 2, z), qt.setFromEuler(e.set(0, -sgn * yaw, -sgn * lean)), sc)
        avenue.setMatrixAt(k, m4)
        dim.set([w, h, d], k * 3)
        misc.set([seed, sgn * cut, bevel, 0], k * 4)
      }
    }
    avenue.geometry = geo.clone() // own geometry per mesh: attributes below differ in length
    avenue.geometry.setAttribute('aDim', new THREE.InstancedBufferAttribute(dim, 3))
    avenue.geometry.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 4))
    avenue.frustumCulled = false
    // blades: thin mineral shards hanging in the air at impossible angles, in mirrored pairs
    const blades = new THREE.InstancedMesh(geo, mat, pairs * 2)
    const bd = new Float32Array(pairs * 2 * 3), bm = new Float32Array(pairs * 2 * 4)
    for (let i = 0; i < pairs; i++) {
      const bz = r.range(-80, 2), bx = r.range(3.6, 9 + -bz * 0.12) * fit, by = r.range(0.2, 6 + -bz * 0.05)
      const w = r.range(0.14, 0.36), h = r.range(1.6, 4.2) * (1 + -bz / 70), d = r.range(0.14, 0.36)
      const yaw = r.range(0, Math.PI), roll = r.range(-0.5, 0.5), seed = r()
      for (const sgn of [-1, 1]) {
        const k = i * 2 + (sgn > 0 ? 1 : 0)
        m4.compose(pv.set(D + sgn * bx, by, bz), qt.setFromEuler(e.set(0, sgn * yaw, -sgn * roll)), sc)
        blades.setMatrixAt(k, m4)
        bd.set([w, h, d], k * 3)
        bm.set([seed, 0, Math.min(0.045, w * 0.3), 0], k * 4)
      }
    }
    blades.geometry = geo.clone()
    blades.geometry.setAttribute('aDim', new THREE.InstancedBufferAttribute(bd, 3))
    blades.geometry.setAttribute('aMisc', new THREE.InstancedBufferAttribute(bm, 4))
    blades.frustumCulled = false
    return { geo, mat, avenue, blades, rows, pairs }
  }, [shared, fit])
  useWorldFrame('dualism', () => {
    // the live tier can drop below the one the world was built for: draw fewer rows, never rebuild
    kit.avenue.count = Math.min(kit.rows, rt.quality.dualRows) * 2
    kit.blades.count = Math.min(kit.pairs, Math.max(2, Math.round(rt.quality.dualCrystals * 0.5))) * 2
  }, -0.5)
  useEffect(() => () => { kit.avenue.geometry.dispose(); kit.blades.geometry.dispose(); kit.geo.dispose(); kit.avenue.dispose(); kit.blades.dispose(); kit.mat.dispose() }, [kit])
  return (
    <group>
      <primitive object={kit.avenue} />
      <primitive object={kit.blades} />
    </group>
  )
}

/* ───────────────────────── the gate: a vast ring on the horizon, completed by the mirror ───────────────────────── */

function Gate({ shared }: { shared: Shared }) {
  const kit = useMemo(() => {
    const geo = new THREE.TorusGeometry(100, 1.5, 8, 256)
    const mat = new THREE.ShaderMaterial({ vertexShader: ringVert, fragmentShader: ringFrag, fog: false, uniforms: { uTime: shared.uTime, uFade: shared.uFade } })
    const mesh = new THREE.InstancedMesh(geo, mat, 2)
    const m4 = new THREE.Matrix4()
    mesh.setMatrixAt(0, m4.makeTranslation(D, FLOOR_Y, -240))
    mesh.setMatrixAt(1, m4.makeScale(0.84, 0.84, 0.84).setPosition(D, FLOOR_Y, -240))
    mesh.frustumCulled = false
    return { geo, mat, mesh }
  }, [shared])
  useEffect(() => () => { kit.geo.dispose(); kit.mat.dispose(); kit.mesh.dispose() }, [kit])
  return <primitive object={kit.mesh} />
}

/* ───────────────────────── the sleeve, inlaid ───────────────────────── */

const HERO = { y: 0.85, w: 4.5, h: 5.8, d: 0.7, cover: 3.4 }

function Hero({ shared }: { shared: Shared }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const kit = useMemo(() => {
    const geo = new RoundedBoxGeometry(1, 1, 1, rt.quality.level >= 2 ? 2 : 1, 0.1)
    // the slab holds the emitter: it is not lit by it from the front, only its bevels pick up a little spill
    const mat = new THREE.ShaderMaterial({
      vertexShader: monoVert, fragmentShader: monoFrag, fog: false,
      uniforms: { uTime: shared.uTime, uFade: shared.uFade, uArtI: { value: 0.1 }, uArt: shared.uArt, uArtCol: shared.uArtCol, uSheen: { value: 1 } },
    })
    const slab = new THREE.InstancedMesh(geo, mat, 1)
    slab.setMatrixAt(0, new THREE.Matrix4())
    geo.setAttribute('aDim', new THREE.InstancedBufferAttribute(new Float32Array([HERO.w, HERO.h, HERO.d]), 3))
    geo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(new Float32Array([0.37, 0, 0.09, 0]), 4))
    slab.frustumCulled = false
    const cover = withExposure(createArtworkMaterial(A.covers.dualismo), 1.0)
    cover.uniforms.uBulge.value = 0
    cover.uniforms.uFlow.value = 0.22
    cover.uniforms.uGrain.value = 0.45
    const coverGeo = new THREE.PlaneGeometry(1, 1)
    const bezelMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: bezelFrag, uniforms: { uTime: shared.uTime, uFade: shared.uFade, uGlow: { value: 1 } },
    })
    const halo = new THREE.SpriteMaterial({ map: A.glow, color: '#6f8cff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, fog: false })
    const haloSprite = new THREE.Sprite(halo)
    haloSprite.layers.set(1) // not mirrored: the planar reflection already carries the real emitter
    haloSprite.scale.set(10.5, 10.5, 1)
    haloSprite.position.set(0, -0.2, -0.9)
    haloSprite.renderOrder = 3
    return { geo, mat, slab, cover, coverGeo, bezelMat, halo, haloSprite }
  }, [shared])
  useEffect(() => () => { kit.geo.dispose(); kit.slab.dispose(); kit.mat.dispose(); kit.cover.dispose(); kit.coverGeo.dispose(); kit.bezelMat.dispose(); kit.halo.dispose() }, [kit])
  useWorldFrame('dualism', () => {
    const o = g.current
    if (!o) return
    const arrive = rt.dual.t
    const cu = kit.cover.uniforms
    cu.uTime.value = rt.time
    cu.uReveal.value = smoothstep(0, 0.7, arrive)
    cu.uSplit.value = 0.0025 + 0.0015 * Math.sin(rt.time * 0.7)
    cu.uGlow.value = 0.6
    cu.uTilt.value.set(rt.px, rt.py)
    // the emitter breathes, very slightly; everything lit by it follows
    const br = 1 + Math.sin(rt.time * 0.9) * 0.05
    shared.uArtI.value = br * smoothstep(0.1, 0.9, arrive)
    kit.mat.uniforms.uArtI.value = 0.08 * br
    kit.halo.opacity = (0.30 + 0.06 * Math.sin(rt.time * 0.9)) * arrive
    const fit = clamp(camera.aspect * 0.8 * 9.27 / HERO.w, 0.5, 1) // keep the monolith inside the frame on narrow screens
    o.scale.setScalar(fit)
    o.position.set(D, HERO.y * fit + (1 - fit) * 0.2 + Math.sin(rt.time * 0.5) * 0.06, 0)
    o.rotation.set(-rt.py * 0.05, 0.11 + rt.px * 0.09, 0)
    shared.uArt.value.set(D, o.position.y, 1.4)
  }, -0.4)
  const z = HERO.d / 2
  return (
    <group ref={g}>
      <primitive object={kit.slab} />
      <mesh geometry={kit.coverGeo} material={kit.bezelMat} position={[0, 0, z + 0.0015]} scale={[HERO.cover / 0.905, HERO.cover / 0.905, 1]} />
      <mesh geometry={kit.coverGeo} material={kit.cover} position={[0, 0, z + 0.0035]} scale={[HERO.cover, HERO.cover, 1]} />
      <primitive object={kit.haloSprite} />
    </group>
  )
}

/* ───────────────────────── light shafts + motes ───────────────────────── */

function Shafts({ shared }: { shared: Shared }) {
  const kit = useMemo(() => {
    const n = rt.quality.level >= 2 ? 3 : rt.quality.level === 1 ? 2 : 1
    const geo = new THREE.PlaneGeometry(1, 1)
    const spec = [
      { x: -7.5, z: -9, w: 7, lean: 0.20, col: [0.32, 0.55, 0.95], seed: 0.3 },
      { x: 8.5, z: -16, w: 9, lean: -0.22, col: [0.9, 0.38, 0.52], seed: 1.7 },
      { x: -1.5, z: -34, w: 12, lean: 0.12, col: [0.48, 0.48, 0.95], seed: 2.9 },
    ].slice(0, n)
    const items = spec.map((s) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: shaftVert, fragmentShader: shaftFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uTime: shared.uTime, uFade: shared.uFade, uSeed: { value: s.seed }, uColor: { value: new THREE.Color(s.col[0], s.col[1], s.col[2]) } },
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.scale.set(s.w, 46, 1)
      mesh.position.set(D + s.x, FLOOR_Y + 20, s.z)
      mesh.rotation.z = s.lean
      mesh.layers.set(1)
      mesh.renderOrder = 2
      mesh.frustumCulled = false
      return { mat, mesh }
    })
    return { geo, items }
  }, [shared])
  useEffect(() => () => { kit.geo.dispose(); kit.items.forEach((i) => i.mat.dispose()) }, [kit])
  return (
    <group>
      {kit.items.map((i, k) => <primitive key={k} object={i.mesh} />)}
    </group>
  )
}

function Motes({ shared }: { shared: Shared }) {
  const camera = useThree((s) => s.camera)
  const kit = useMemo(() => {
    const s0 = rt.quality.particleScale
    const n = Math.round(170 * s0)
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const r = rng(42)
    for (let i = 0; i < n; i++) {
      pos.set([D + r.range(-13, 13), r.range(-2, 8), r.range(-34, 7)], i * 3)
      seed[i] = r()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: moteVert, fragmentShader: moteFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uArrive: { value: 0 }, uPx: { value: 1 }, uMouse: { value: new THREE.Vector3(D, 0, 0) } },
    })
    const pts = new THREE.Points(g, mat)
    pts.layers.set(1)
    pts.frustumCulled = false
    pts.renderOrder = 5
    return { g, mat, pts, n, s0, v2: new THREE.Vector2(), ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3() }
  }, [shared])
  useWorldFrame('dualism', () => {
    const u = kit.mat.uniforms
    u.uArrive.value = rt.dual.t
    u.uPx.value = rt.dpr
    kit.g.setDrawRange(0, Math.max(1, Math.round(kit.n * Math.min(1, rt.quality.particleScale / kit.s0))))
    kit.ray.setFromCamera(kit.v2.set(rt.rx, rt.ry), camera)
    if (kit.ray.ray.intersectPlane(kit.plane, kit.hit)) u.uMouse.value.lerp(kit.hit, 0.15)
  }, -0.5)
  useEffect(() => () => { kit.g.dispose(); kit.mat.dispose() }, [kit])
  return <primitive object={kit.pts} />
}

/* ───────────────────────── entry tunnel (only while arriving) ───────────────────────── */

const TUNNEL_N = 12
function EntryTunnel() {
  const kit = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.014, 6, 80)
    const seeds = new Float32Array(TUNNEL_N)
    for (let i = 0; i < TUNNEL_N; i++) seeds[i] = i * 0.137
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    const mat = new THREE.ShaderMaterial({ vertexShader: entryRingVert, fragmentShader: entryRingFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uFade: { value: 0 }, uTime: { value: 0 } } })
    const mesh = new THREE.InstancedMesh(geo, mat, TUNNEL_N)
    mesh.frustumCulled = false
    mesh.layers.set(1)
    mesh.renderOrder = 1
    return { geo, mat, mesh, m4: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }
  }, [])
  useWorldFrame('dualism', () => {
    const arrive = rt.dual.t
    const on = arrive < 0.985
    if (kit.mesh.visible !== on) kit.mesh.visible = on
    if (!on) return
    kit.mat.uniforms.uTime.value = rt.time
    kit.mat.uniforms.uFade.value = (1 - smoothstep(0.55, 0.98, arrive)) * smoothstep(0, 0.12, arrive)
    for (let i = 0; i < TUNNEL_N; i++) {
      const flow = (rt.time * 1.6 + i * 3.2) % (TUNNEL_N * 3.2)
      const z = 2 - flow
      const rad = (3.5 + Math.sin(i * 0.9) * 0.4) * (1 + Math.max(0, -z - 18) * 0.015)
      kit.mesh.setMatrixAt(i, kit.m4.compose(kit.p.set(D, 0, z), kit.q.setFromEuler(kit.e.set(0, 0, rt.time * 0.1 + i)), kit.s.set(rad, rad, rad)))
    }
    kit.mesh.instanceMatrix.needsUpdate = true
  }, -0.5)
  useEffect(() => () => { kit.geo.dispose(); kit.mat.dispose(); kit.mesh.dispose() }, [kit])
  return <primitive object={kit.mesh} />
}

/* ───────────────────────── track tokens ───────────────────────── */

const coinProfile = [[0, 0.075], [0.5, 0.075], [0.575, 0.062], [0.605, 0.03], [0.605, -0.03], [0.575, -0.062], [0.5, -0.075], [0, -0.075]].map(([x, y]) => new THREE.Vector2(x, y))

/** Two tokens, one per track, on one tilted orbit around the monolith (point-symmetric: when one is near and low the other is far and high).
 *  Selecting a track lifts it out of the orbit onto a clear stage beside the sleeve, with its title ring facing the viewer. */
function Orbiter({ index, shared }: { index: number; shared: Shared }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const ringTex = A.dualLabels[index]
  const kit = useMemo(() => {
    const face = withExposure(createArtworkMaterial(A.covers.dualismo), index === 0 ? 1.0 : 0.5)
    face.uniforms.uFlow.value = 0.2
    face.uniforms.uBulge.value = 0
    const coin = new THREE.ShaderMaterial({ vertexShader: coinVert, fragmentShader: coinFrag, fog: false, uniforms: { uTime: shared.uTime, uFade: shared.uFade, uGlow: { value: 0 }, uTint: { value: new THREE.Color(index === 0 ? '#5f9bff' : '#ff6f93') } } })
    const ring = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, side: THREE.DoubleSide, fog: false })
    const faceGeo = new THREE.CircleGeometry(0.56, 56)
    const coinGeo = new THREE.LatheGeometry(coinProfile, 40)
    coinGeo.rotateX(Math.PI / 2)
    const ringGeo = new THREE.PlaneGeometry(2.0, 2.0)
    return { face, coin, ring, faceGeo, coinGeo, ringGeo }
  }, [ringTex, index, shared])
  const st = useRef({ hov: 0, sel: 0, flag: false })
  useEffect(() => () => { kit.face.dispose(); kit.coin.dispose(); kit.ring.dispose(); kit.faceGeo.dispose(); kit.coinGeo.dispose(); kit.ringGeo.dispose() }, [kit])

  useWorldFrame('dualism', (_, dt) => {
    const o = g.current
    if (!o) return
    const s = st.current
    const selected = useStore.getState().dualismoTrack === index
    s.hov += ((s.flag ? 1 : 0) - s.hov) * Math.min(1, dt * 6)
    s.sel += ((selected ? 1 : 0) - s.sel) * Math.min(1, dt * 2.6)
    const aspect = camera.aspect
    const fit = fitFor(aspect)
    const wide = clamp((aspect - 1.0) / 0.5)
    const arrive = rt.dual.t
    // orbit: ellipse tilted so the near pass is low (under the sleeve) and the far pass high (behind it)
    const t = rt.time * 0.14 + index * Math.PI
    const k = 0.3 + 0.7 * arrive
    const ox = Math.cos(t) * 5.8 * fit * k
    const oz = Math.sin(t) * 2.8 * k - 0.7
    const oy = 0.5 - Math.sin(t) * 1.95
    // stage: right of the sleeve on a wide screen, under it on a tall one
    const sx = wide * Math.min(4.5, 2.42 * aspect)
    const sy = -0.2 * wide + -1.35 * (1 - wide)
    const sz = 1.5 * wide + 3.8 * (1 - wide)
    const w = s.sel * s.sel * (3 - 2 * s.sel)
    o.position.set(D + ox + (sx - ox) * w, oy + (sy - oy) * w, oz + (sz - oz) * w)
    const scale = (0.9 + s.hov * 0.2) * (1 + w * 0.75) * smoothstep(0, 0.5, arrive)
    o.scale.setScalar(scale)
    o.lookAt(D, 0.3, 14)
    const f = kit.face.uniforms
    f.uTime.value = rt.time
    f.uSplit.value = 0.002 + s.hov * 0.01
    f.uGlow.value = 0.2 + s.hov * 0.5 + w * 0.5
    f.uReveal.value = 1
    kit.coin.uniforms.uGlow.value = s.hov + w
    kit.ring.opacity = 0.5 + s.hov * 0.3 + w * 0.2
    ;(o.children[2] as THREE.Mesh).rotation.z = rt.time * 0.22 * (index === 0 ? 1 : -1)
    o.visible = arrive > 0.02
  }, -0.4)

  return (
    <group ref={g}>
      <mesh geometry={kit.coinGeo} material={kit.coin} />
      <mesh
        geometry={kit.faceGeo}
        material={kit.face}
        position={[0, 0, 0.078]}
        onPointerOver={(e) => { e.stopPropagation(); st.current.flag = true; useStore.getState().setCursor('track', 'OPEN') }}
        onPointerOut={() => { st.current.flag = false; useStore.getState().setCursor('default') }}
        onClick={(e) => { e.stopPropagation(); const s = useStore.getState(); s.set({ dualismoTrack: s.dualismoTrack === index ? null : index }) }}
      />
      <mesh geometry={kit.ringGeo} material={kit.ring} position={[0, 0, -0.03]} layers={1} renderOrder={4} />
    </group>
  )
}

/* ───────────────────────── the way back ───────────────────────── */

function ReturnDoor() {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const kit = useMemo(() => {
    const ring = new THREE.MeshBasicMaterial({ map: A.returnLabel, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, side: THREE.DoubleSide, fog: false })
    const door = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: doorFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime: { value: 0 }, uGlow: { value: 0 } },
    })
    const core = new THREE.SpriteMaterial({ map: A.glow, color: '#ffa860', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, fog: false })
    return { ring, door, core, ringGeo: new THREE.PlaneGeometry(1.7, 1.7), doorGeo: new THREE.PlaneGeometry(0.4, 1.15) }
  }, [])
  const st = useRef({ hov: 0, flag: false })
  useEffect(() => () => { kit.ring.dispose(); kit.door.dispose(); kit.core.dispose(); kit.ringGeo.dispose(); kit.doorGeo.dispose() }, [kit])
  useWorldFrame('dualism', (_, dt) => {
    const o = g.current
    if (!o) return
    const s = st.current
    s.hov += ((s.flag ? 1 : 0) - s.hov) * Math.min(1, dt * 7)
    const aspect = camera.aspect
    const px = Math.min(3.4, 1.0 + 2.4 * clamp((aspect - 0.5) / 1.1))
    o.position.set(D - px, -1.35 + Math.sin(rt.time * 0.6) * 0.06, 4.4)
    o.scale.setScalar((0.8 + s.hov * 0.2) * smoothstep(0.3, 1, rt.dual.t))
    ;(o.children[0] as THREE.Mesh).rotation.z = rt.time * 0.15
    kit.ring.opacity = 0.42 + s.hov * 0.5
    kit.core.opacity = 0.28 + s.hov * 0.4
    kit.door.uniforms.uTime.value = rt.time
    kit.door.uniforms.uGlow.value = s.hov
  }, -0.4)
  return (
    <group ref={g}>
      <mesh
        geometry={kit.ringGeo}
        material={kit.ring}
        renderOrder={4}
        onPointerOver={(e) => { e.stopPropagation(); st.current.flag = true; useStore.getState().setCursor('portal', 'RETURN') }}
        onPointerOut={() => { st.current.flag = false; useStore.getState().setCursor('default') }}
        onClick={(e) => { e.stopPropagation(); exitDualism() }}
      />
      <mesh geometry={kit.doorGeo} material={kit.door} position={[0, 0, 0.01]} renderOrder={4} />
      <sprite material={kit.core} scale={[1.7, 1.7, 1]} position={[0, 0, -0.02]} renderOrder={3} />
    </group>
  )
}

export function DualismoWorld() {
  const shared = useMemo(makeShared, [])
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  // quantised so a window resize does not rebuild the instance buffers on every pixel
  const fit = Math.round(fitFor(aspect) * 8) / 8
  useWorldFrame('dualism', () => {
    shared.uTime.value = rt.time
    shared.uFade.value = smoothstep(0.0, 0.55, rt.dual.t)
  }, -0.7)
  return (
    <group>
      <Backdrop shared={shared} />
      <MirrorFloor shared={shared} />
      <Gate shared={shared} />
      <Monoliths shared={shared} fit={fit} />
      <Shafts shared={shared} />
      <Hero shared={shared} />
      <EntryTunnel />
      {dualismo.tracks.map((t, i) => (
        <Orbiter key={t.id} index={i} shared={shared} />
      ))}
      <ReturnDoor />
      <Motes shared={shared} />
    </group>
  )
}
