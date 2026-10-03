import { CP, orbitZone } from './timeline'
import { goTo } from './scroll'
import { rt } from './runtime'
import { alterco } from '@/data/project'
import { useStore } from './store'

export const progressForTrack = (i: number) => orbitZone.a + (i / (alterco.tracks.length - 1)) * (orbitZone.b - orbitZone.a)

export function jumpToTrack(i: number) {
  rt.orbit.resetDrag = true
  goTo(progressForTrack(i), { duration: 1.6 })
}

export const SCENES = [
  { id: 'alley', n: '01', label: 'ALLEY', from: 0, to: CP.tracksStart - 0.02 },
  { id: 'tracks', n: '02', label: 'THE SEVEN', from: CP.tracksStart - 0.02, to: CP.dive - 0.02 },
  { id: 'roof', n: '03', label: 'ROOFTOP', from: CP.dive - 0.02, to: 1.01 },
] as const

export function sceneAt(p: number) {
  return SCENES.find((s) => p >= s.from && p < s.to) ?? SCENES[SCENES.length - 1]
}

export function timeLabel(p: number) {
  if (p < 0.18) return 'LATE AFTERNOON'
  if (p < 0.5) return 'SUNSET'
  if (p < 0.82) return 'BLUE HOUR'
  return 'NIGHT'
}

export function closeMenu() {
  useStore.getState().set({ menu: false })
}
