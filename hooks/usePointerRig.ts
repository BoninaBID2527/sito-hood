'use client'

import { useEffect } from 'react'
import { rt } from '@/lib/runtime'
import { isTouchDevice } from '@/lib/quality'

/**
 * Writes raw pointer + (optional) device-tilt into the shared runtime.
 * The camera never reads these 1:1 — the Director smooths them first.
 */
export function usePointerRig() {
  useEffect(() => {
    rt.touch = isTouchDevice()
    rt.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => (rt.reducedMotion = mq.matches)
    mq.addEventListener('change', onMq)

    const onMove = (e: PointerEvent) => {
      rt.mx = e.clientX
      rt.my = e.clientY
      if (e.pointerType === 'touch') return // touch uses drag, not hover parallax
      rt.rx = (e.clientX / window.innerWidth) * 2 - 1
      rt.ry = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onDown = () => (rt.down = true)
    const onUp = () => (rt.down = false)
    const onLeave = () => { rt.rx = 0; rt.ry = 0 }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      mq.removeEventListener('change', onMq)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])
}

/** Optional: device orientation → subtle camera tilt. Only after explicit permission (iOS) — never required. */
export async function enableTilt(): Promise<boolean> {
  const D = (window as any).DeviceOrientationEvent
  if (!D) return false
  try {
    if (typeof D.requestPermission === 'function') {
      const res = await D.requestPermission()
      if (res !== 'granted') return false
    }
  } catch {
    return false
  }
  const onOri = (e: DeviceOrientationEvent) => {
    const g = (e.gamma ?? 0) / 35
    const b = ((e.beta ?? 45) - 45) / 35
    rt.tx = Math.max(-1, Math.min(1, g)) * 0.7
    rt.ty = -Math.max(-1, Math.min(1, b)) * 0.5
  }
  window.addEventListener('deviceorientation', onOri, true)
  return true
}
