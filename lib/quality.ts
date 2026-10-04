/**
 * Quality tiers. The visitor never sees these: the tier is chosen from the device, then adapted at runtime
 * (see lib/adaptive.ts). Developer overrides: `?quality=mobile|balanced|high|ultra` (legacy: low → mobile, medium → balanced).
 */
export type Tier = 'ultra' | 'high' | 'balanced' | 'mobile'
export const TIERS: Tier[] = ['ultra', 'high', 'balanced', 'mobile']

export interface QualitySettings {
  tier: Tier
  /** 3 = ultra … 0 = mobile */
  level: 0 | 1 | 2 | 3
  dprMax: number
  dprMin: number
  msaa: number
  /** real planar reflections (false = analytic sky/horizon approximation in the same shader) */
  reflector: boolean
  reflectorRes: number
  /** the reflection pass re-renders the scene every N frames (1 = every frame) */
  reflectEvery: number
  particleScale: number
  steam: number
  bloom: number
  grain: number
  windows: boolean
  fireEscapeDetail: number
  /** haze sheets / light shafts in the street */
  haze: number
  shafts: number
  /** DUALISMO glass-hall density */
  dualRows: number
  dualCrystals: number
  /** graffiti atlas resolution multiplier */
  atlas: number
  /** how many track stations around the focused one get the full-cost treatment (each side) */
  trackReach: number
}

export const SETTINGS: Record<Tier, QualitySettings> = {
  ultra: { tier: 'ultra', level: 3, dprMax: 2, dprMin: 1.25, msaa: 4, reflector: true, reflectorRes: 1024, reflectEvery: 1, particleScale: 1, steam: 6, bloom: 0.35, grain: 1, windows: true, fireEscapeDetail: 1, haze: 8, shafts: 5, dualRows: 26, dualCrystals: 30, atlas: 1, trackReach: 3 },
  high: { tier: 'high', level: 2, dprMax: 1.5, dprMin: 1, msaa: 4, reflector: true, reflectorRes: 768, reflectEvery: 1, particleScale: 1, steam: 6, bloom: 0.35, grain: 1, windows: true, fireEscapeDetail: 1, haze: 8, shafts: 5, dualRows: 26, dualCrystals: 30, atlas: 0.9, trackReach: 2 },
  balanced: { tier: 'balanced', level: 1, dprMax: 1.4, dprMin: 1, msaa: 2, reflector: true, reflectorRes: 384, reflectEvery: 2, particleScale: 0.6, steam: 4, bloom: 0.25, grain: 0.9, windows: true, fireEscapeDetail: 0.7, haze: 5, shafts: 3, dualRows: 18, dualCrystals: 18, atlas: 0.75, trackReach: 2 },
  mobile: { tier: 'mobile', level: 0, dprMax: 1.2, dprMin: 0.8, msaa: 0, reflector: false, reflectorRes: 256, reflectEvery: 3, particleScale: 0.3, steam: 2, bloom: 0.16, grain: 0.7, windows: true, fireEscapeDetail: 0.4, haze: 3, shafts: 2, dualRows: 12, dualCrystals: 10, atlas: 0.6, trackReach: 0.5 },
}

const ALIAS: Record<string, Tier> = { low: 'mobile', medium: 'balanced', mobile: 'mobile', balanced: 'balanced', high: 'high', ultra: 'ultra' }

/** `?quality=` override (developer testing). Returns null for normal visitors. */
export function forcedTier(): Tier | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('quality')
  return q && ALIAS[q.toLowerCase()] ? ALIAS[q.toLowerCase()] : null
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}

/** Tablet-class: touch with a large screen (iPad, Android tablets). */
export function isTablet() {
  if (typeof window === 'undefined') return false
  return isTouchDevice() && Math.min(window.screen.width, window.screen.height) >= 600
}

function gpuInfo() {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return { renderer: '', maxTex: 0 }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { renderer, maxTex }
  } catch {
    return { renderer: '', maxTex: 0 }
  }
}

/** Initial tier from the device. Runtime adaptation (lib/adaptive.ts) can only move down from here and back up to it. */
export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'balanced'
  const forced = forcedTier()
  if (forced) return forced
  const touch = isTouchDevice()
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency || 4
  const { renderer, maxTex } = gpuInfo()
  const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer)
  if (software || (maxTex > 0 && maxTex < 4096)) return 'mobile'
  if (touch) {
    // phone → mobile; tablet (iPad-class) → balanced; weak tablet → mobile
    if (!isTablet()) return 'mobile'
    if ((mem && mem <= 3) || cores <= 4) return 'mobile'
    return 'balanced'
  }
  if ((mem && mem <= 4) || cores <= 4) return 'balanced'
  if (cores >= 10 && (mem ?? 8) >= 8 && maxTex >= 16384) return 'ultra'
  return 'high'
}

export const stepTier = (t: Tier, dir: 1 | -1): Tier => TIERS[Math.min(TIERS.length - 1, Math.max(0, TIERS.indexOf(t) + dir))]
