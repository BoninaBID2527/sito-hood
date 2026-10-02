import { motionValue } from 'motion/react'
import { rt } from './runtime'

/** Motion values mirroring the runtime so DOM layers can be scroll/pointer-linked without React re-renders. */
export const progressMV = motionValue(0)
export const velocityMV = motionValue(0)
export const pxMV = motionValue(0)
export const pyMV = motionValue(0)

let raf = 0
export function startMotionBridge() {
  if (raf) return () => undefined
  const loop = () => {
    progressMV.set(rt.smooth)
    velocityMV.set(rt.velocity)
    pxMV.set(rt.px)
    pyMV.set(rt.py)
    raf = requestAnimationFrame(loop)
  }
  loop()
  return () => {
    cancelAnimationFrame(raf)
    raf = 0
  }
}
