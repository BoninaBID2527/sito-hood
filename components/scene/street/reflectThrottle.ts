import * as THREE from 'three'
import { rt } from '@/lib/runtime'

/**
 * A planar reflection is a second full scene render. It does not need to run every frame:
 *  · standing still (camera unmoved) → refresh at most every 0.25 s (steam / lamp flicker are invisible at that cadence)
 *  · moving → every `reflectEvery` frames (tier setting; 1 = every frame), never staler than 120 ms
 * The texture matrix is recomputed together with the image, so old image + old matrix always stay consistent.
 */
export function throttleReflector(r: THREE.Mesh) {
  const orig = (r as unknown as { onBeforeRender: (...a: unknown[]) => void }).onBeforeRender
  let n = 0
  let lastT = -10
  const lastP = new THREE.Vector3(1e9, 0, 0)
  const lastQ = new THREE.Quaternion()
  ;(r as unknown as { onBeforeRender: (...a: unknown[]) => void }).onBeforeRender = function (this: unknown, renderer: unknown, scene: unknown, camera: unknown, ...rest: unknown[]) {
    const cam = camera as THREE.Camera
    const every = Math.max(1, rt.quality.reflectEvery)
    const moved = cam.position.distanceToSquared(lastP) > 4e-6 || Math.abs(cam.quaternion.dot(lastQ)) < 0.9999995
    const age = rt.time - lastT
    n++
    if (!moved && age < 0.25) return
    if (moved && every > 1 && n % every !== 0 && age < 0.12) return
    lastP.copy(cam.position)
    lastQ.copy(cam.quaternion)
    lastT = rt.time
    orig.call(this, renderer, scene, camera, ...rest)
  }
}
