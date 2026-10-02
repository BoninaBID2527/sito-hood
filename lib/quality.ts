export type Tier = 'high' | 'medium' | 'low'

export interface QualitySettings {
  tier: Tier
  dprMax: number
  msaa: number
  reflector: boolean
  reflectorRes: number
  particleScale: number
  steam: number
  bloom: number
  grain: number
  windows: boolean
  fireEscapeDetail: number
}

export const SETTINGS: Record<Tier, QualitySettings> = {
  high: { tier: 'high', dprMax: 1.5, msaa: 4, reflector: true, reflectorRes: 768, particleScale: 1, steam: 6, bloom: 0.35, grain: 1, windows: true, fireEscapeDetail: 1 },
  medium: { tier: 'medium', dprMax: 1.25, msaa: 2, reflector: true, reflectorRes: 384, particleScale: 0.6, steam: 4, bloom: 0.25, grain: 0.9, windows: true, fireEscapeDetail: 0.7 },
  low: { tier: 'low', dprMax: 1, msaa: 0, reflector: false, reflectorRes: 256, particleScale: 0.3, steam: 2, bloom: 0, grain: 0.7, windows: true, fireEscapeDetail: 0.4 },
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}

export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'medium'
  const touch = isTouchDevice()
  const small = Math.min(window.innerWidth, window.innerHeight) < 560
  const mem = (navigator as any).deviceMemory as number | undefined
  const cores = navigator.hardwareConcurrency || 4
  if (touch && (small || (mem && mem <= 4) || cores <= 4)) return 'low'
  if (touch) return 'medium'
  if ((mem && mem <= 4) || cores <= 4) return 'medium'
  return 'high'
}

export function stepTier(t: Tier, dir: 1 | -1): Tier {
  const order: Tier[] = ['high', 'medium', 'low']
  return order[Math.min(2, Math.max(0, order.indexOf(t) + dir))]
}
