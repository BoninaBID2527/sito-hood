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
  { p: 0.0, skyTop: '#46648f', skyMid: '#a78f82', horizon: '#dcb48c', fog: '#5e5249', hemiSky: '#8fa4bf', hemiGround: '#3a2e28', sun: '#ffb870', hemiI: 0.5, sunI: 1.7, fogDensity: 0.0125, lamps: 0.25, windows: 0.1, stars: 0, sunHeight: 1, glow: 0.7 },
  { p: 0.3, skyTop: '#33436f', skyMid: '#b9615a', horizon: '#ff9a52', fog: '#52403c', hemiSky: '#7a6a8a', hemiGround: '#32231f', sun: '#ff7a3a', hemiI: 0.42, sunI: 1.3, fogDensity: 0.0135, lamps: 0.65, windows: 0.4, stars: 0, sunHeight: 0.55, glow: 1 },
  { p: 0.6, skyTop: '#141d4a', skyMid: '#46446f', horizon: '#dc6f5a', fog: '#2c2a44', hemiSky: '#45558a', hemiGround: '#1c1824', sun: '#6a6aa0', hemiI: 0.4, sunI: 0.35, fogDensity: 0.0145, lamps: 1, windows: 0.8, stars: 0.1, sunHeight: 0.05, glow: 0.7 },
  { p: 0.76, skyTop: '#0e1943', skyMid: '#3d4888', horizon: '#f08a58', fog: '#383a68', hemiSky: '#4a5a98', hemiGround: '#2a2230', sun: '#ff8a50', hemiI: 0.5, sunI: 1.0, fogDensity: 0.0065, lamps: 1, windows: 0.7, stars: 0.2, sunHeight: 0.2, glow: 1 },
  { p: 0.9, skyTop: '#070c26', skyMid: '#1b2656', horizon: '#9a5a7a', fog: '#1c2142', hemiSky: '#34427e', hemiGround: '#15141f', sun: '#7a8ad0', hemiI: 0.36, sunI: 0.4, fogDensity: 0.0055, lamps: 1.1, windows: 0.95, stars: 0.6, sunHeight: 0, glow: 0.45 },
  { p: 1.0, skyTop: '#04071a', skyMid: '#0e1634', horizon: '#4b3a62', fog: '#10152c', hemiSky: '#2a3770', hemiGround: '#10101c', sun: '#6a7bd0', hemiI: 0.3, sunI: 0.3, fogDensity: 0.005, lamps: 1.2, windows: 1, stars: 0.95, sunHeight: 0, glow: 0.3 },
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
