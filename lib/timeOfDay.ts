import * as THREE from 'three'
import { clamp } from './math'

export interface Palette {
  skyTop: THREE.Color
  skyMid: THREE.Color
  horizon: THREE.Color
  fog: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  sun: THREE.Color
  hemiI: number
  sunI: number
  fogDensity: number
  lamps: number
  windows: number
  stars: number
  sunHeight: number // 0..1 — drives the golden band on the alley walls
  glow: number // horizon glow strength
}

const c = (h: string) => new THREE.Color(h)

interface K {
  p: number
  skyTop: string; skyMid: string; horizon: string; fog: string
  hemiSky: string; hemiGround: string; sun: string
  hemiI: number; sunI: number; fogDensity: number
  lamps: number; windows: number; stars: number; sunHeight: number; glow: number
}

// late afternoon → sunset → blue hour → night
const KEYS: K[] = [
  // late afternoon: cool sky fill in the shade, warm sun only on the high walls + the far glow
  { p: 0.0, skyTop: '#3f6396', skyMid: '#8f9aa8', horizon: '#e0b48a', fog: '#59656f', hemiSky: '#86a4cc', hemiGround: '#34302f', sun: '#ffb468', hemiI: 0.62, sunI: 1.8, fogDensity: 0.0125, lamps: 0.3, windows: 0.12, stars: 0, sunHeight: 1, glow: 0.7 },
  // sunset: magenta/teal split, lamps and windows take over
  { p: 0.3, skyTop: '#2c3f78', skyMid: '#a65a6e', horizon: '#ff8f55', fog: '#4a4256', hemiSky: '#6a74a8', hemiGround: '#2d2224', sun: '#ff7438', hemiI: 0.5, sunI: 1.25, fogDensity: 0.0135, lamps: 0.7, windows: 0.45, stars: 0, sunHeight: 0.55, glow: 1 },
  // blue hour
  { p: 0.6, skyTop: '#121c52', skyMid: '#3c4682', horizon: '#d86d6a', fog: '#28304f', hemiSky: '#4560a0', hemiGround: '#1a1a2a', sun: '#6a74b4', hemiI: 0.46, sunI: 0.35, fogDensity: 0.0145, lamps: 1, windows: 0.85, stars: 0.1, sunHeight: 0.05, glow: 0.7 },
  { p: 0.76, skyTop: '#0d1a4a', skyMid: '#36489a', horizon: '#ee8660', fog: '#303a6c', hemiSky: '#4a62a8', hemiGround: '#242034', sun: '#ff8a55', hemiI: 0.52, sunI: 1.0, fogDensity: 0.0065, lamps: 1, windows: 0.75, stars: 0.2, sunHeight: 0.2, glow: 1 },
  { p: 0.9, skyTop: '#060b28', skyMid: '#18265c', horizon: '#8a587f', fog: '#171e44', hemiSky: '#344a8a', hemiGround: '#14141f', sun: '#7a8ad0', hemiI: 0.38, sunI: 0.4, fogDensity: 0.0055, lamps: 1.1, windows: 0.95, stars: 0.6, sunHeight: 0, glow: 0.45 },
  { p: 1.0, skyTop: '#03061a', skyMid: '#0d1738', horizon: '#6c4570', fog: '#0e1430', hemiSky: '#2a3a78', hemiGround: '#0f0f1c', sun: '#6a7bd0', hemiI: 0.3, sunI: 0.3, fogDensity: 0.005, lamps: 1.2, windows: 1, stars: 0.95, sunHeight: 0, glow: 0.3 },
]

const keys = KEYS.map((k) => ({
  ...k,
  skyTop: c(k.skyTop), skyMid: c(k.skyMid), horizon: c(k.horizon), fog: c(k.fog),
  hemiSky: c(k.hemiSky), hemiGround: c(k.hemiGround), sun: c(k.sun),
}))

export const palette: Palette = {
  skyTop: new THREE.Color(), skyMid: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(),
  hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Color(),
  hemiI: 0, sunI: 0, fogDensity: 0, lamps: 0, windows: 0, stars: 0, sunHeight: 0, glow: 0,
}

export function evalTimeOfDay(p: number): Palette {
  p = clamp(p)
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1].p) i++
  const a = keys[i], b = keys[i + 1]
  let t = clamp((p - a.p) / (b.p - a.p))
  t = t * t * (3 - 2 * t)
  for (const k of ['skyTop', 'skyMid', 'horizon', 'fog', 'hemiSky', 'hemiGround', 'sun'] as const) palette[k].copy(a[k]).lerp(b[k], t)
  for (const k of ['hemiI', 'sunI', 'fogDensity', 'lamps', 'windows', 'stars', 'sunHeight', 'glow'] as const) palette[k] = a[k] + (b[k] - a[k]) * t
  return palette
}
