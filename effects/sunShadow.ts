import * as THREE from 'three'
import { rt } from '@/lib/runtime'
import { PLAZA } from '@/components/scene/street/layout'
import { WORLD } from '@/lib/timeline'

/**
 * The hybrid shadow system: ONE real sun shadow map, tightly fitted to what the camera can actually use, rebuilt only when it must be.
 *   alley  — a box around the camera's stretch of street (snapped to 12 m steps → re-rendered a few times per second at full scroll speed,
 *            never while standing still). Casters: facades, relief, fire escapes. Receivers: walls, kerbs, ground.
 *   plaza  — a box around the track installation (the ring moves → refreshed every 2nd frame while the visitor is there).
 *   roof   — a box around the rooftop deck (static: refreshed every ~20 frames).
 * Everything else (props, lamps, small hardware) gets baked vertex AO + contact decals instead. Tier mobile: no shadow maps at all.
 */
export const SUN_DIR = new THREE.Vector3(0.17, 0.17, -0.97).normalize() // from the scene toward the sun (low sun at the far end of the alley)

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
let lastKey = ''
let frame = 0

interface Box { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number }

export function updateSunShadow(light: THREE.DirectionalLight, camZ: number): { mode: string; updated: boolean } {
  const sh = light.shadow
  const size = rt.quality.shadow
  const w = rt.world
  if (size === 0 || (w !== 'alley' && w !== 'roof')) { sh.autoUpdate = false; return { mode: 'off', updated: false } }
  let box: Box, mode: string, every = 0
  if (w === 'roof') { mode = 'roof'; box = { cx: WORLD.roofX + 4, cy: 12, cz: -24, hx: 22, hy: 20, hz: 50 }; every = 20 }
  else if (camZ < PLAZA.z0 + 10) { mode = 'plaza'; box = { cx: 0, cy: 9, cz: -100, hx: 15, hy: 13, hz: 34 }; every = 2 }
  else { mode = 'alley'; box = { cx: 0, cy: 13, cz: Math.round((camZ - 38) / 12) * 12, hx: 9, hy: 15, hz: 66 } }

  light.target.position.set(box.cx, box.cy, box.cz)
  light.position.copy(light.target.position).addScaledVector(SUN_DIR, 200)
  const key = `${mode}|${box.cz}|${size}`
  let need = key !== lastKey
  frame++
  if (every && frame % every === 0) need = true
  if (!need) return { mode, updated: false }
  lastKey = key

  light.target.updateMatrixWorld()
  light.updateMatrixWorld()
  // fit an orthographic frustum around the world box, in light space
  _m.lookAt(light.position, light.target.position, UP)
  _m.setPosition(light.position)
  _inv.copy(_m).invert()
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    _p.set(box.cx + sx * box.hx, box.cy + sy * box.hy, box.cz + sz * box.hz).applyMatrix4(_inv)
    x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z)
  }
  const c = sh.camera as THREE.OrthographicCamera
  c.left = x0; c.right = x1; c.bottom = y0; c.top = y1
  c.near = Math.max(0.5, -z1); c.far = -z0
  c.updateProjectionMatrix()
  if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); sh.map?.dispose(); sh.map = null }
  sh.bias = -0.0007
  sh.normalBias = 0.035
  sh.radius = rt.quality.shadowSoft ? 2.2 : 1
  sh.autoUpdate = false
  sh.needsUpdate = true
  return { mode, updated: true }
}
