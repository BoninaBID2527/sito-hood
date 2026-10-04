import { saveNums, saveFound, saveReturned } from './secrets'
import gsap from 'gsap'
import { rt } from './runtime'
import { useStore, TRACK_COUNT } from './store'
import { lockScroll, unlockScroll } from './scroll'
import { audio } from './audio'
import { alterco, dualismo, pad } from '@/data/project'

/** Camera-independent "story" actions. UI and 3D both call these. */

export function enterExperience(withSound: boolean) {
  const s = useStore.getState()
  if (s.phase === 'entered') return
  s.set({ phase: 'entered', sound: withSound })
  if (withSound) audio.start()
  rt.intro.t = 0
  gsap.to(rt.fx, { fade: 1, duration: rt.reducedMotion ? 0.4 : 2.6, ease: 'power2.inOut', delay: 0.15 })
  gsap.to(rt.intro, { t: 1, duration: rt.reducedMotion ? 0.01 : 5.2, ease: 'power3.out' })
  unlockScroll()
}

export function toggleSound() {
  const s = useStore.getState()
  const next = !s.sound
  s.set({ sound: next })
  if (next) audio.start()
  else audio.stop()
}

export function selectTrack(i: number | null) {
  const s = useStore.getState()
  if (i === null) {
    s.set({ selected: null })
    gsap.to(rt.fx, { focusDim: 0, duration: 0.8, ease: 'power2.out' })
    unlockScroll()
    return
  }
  const idx = ((i % TRACK_COUNT) + TRACK_COUNT) % TRACK_COUNT
  s.set({ selected: idx })
  s.visit(idx)
  lockScroll()
  gsap.to(rt.fx, { focusDim: 0.32, duration: 1.0, ease: 'power2.out' })
  rt.impulse.rgb = Math.max(rt.impulse.rgb, 0.006)
  audio.thud()
  const v = useStore.getState().visited
  if (v.length === TRACK_COUNT) {
    useStore.getState().markEgg('tracks')
    queueMicrotask(() => useStore.getState().say('SEVEN OF SEVEN', 'Something changed on the rooftop.'))
  }
}

export function enterDualism() {
  const s = useStore.getState()
  if (s.mode !== 'alterco') return
  s.set({ mode: 'dualism-in', selected: null, dualismoFound: true })
  s.markEgg('portal')
  saveFound()
  lockScroll()
  audio.whoosh()
  const tl = gsap.timeline()
  // the street first stops being solid (material bleeds into spectral bands, walls swell), then the tunnel takes over
  tl.to(rt.fx, { dissolve: 1, duration: rt.reducedMotion ? 0.3 : 1.7, ease: 'sine.in' })
  tl.to(rt.fx, { tunnel: 1, glitch: 0, duration: rt.reducedMotion ? 0.5 : 2.3, ease: 'power3.in' }, rt.reducedMotion ? 0 : 0.5)
  tl.add(() => {
    useStore.getState().set({ mode: 'dualism' })
    rt.world = 'dualism'
    rt.dual.t = 0
  })
  tl.to(rt.fx, { dualism: 1, duration: 0.01 }, '<')
  tl.to(rt.fx, { tunnel: 0, duration: rt.reducedMotion ? 0.5 : 2.2, ease: 'power3.out' })
  tl.to(rt.dual, { t: 1, duration: 4.5, ease: 'power3.out' }, '<')
  s.say('DUALISMO', 'You found the other side.')
}

export function exitDualism() {
  const s = useStore.getState()
  if (s.mode !== 'dualism') return
  s.set({ mode: 'dualism-out', dualismoTrack: null })
  audio.whoosh()
  const tl = gsap.timeline()
  tl.to(rt.fx, { tunnel: 1, duration: rt.reducedMotion ? 0.4 : 1.7, ease: 'power3.in' })
  tl.add(() => {
    useStore.getState().set({ mode: 'alterco', dualReturned: true })
    saveReturned()
    rt.fx.dualism = 0
    rt.fx.dissolve = 0
  })
  tl.to(rt.fx, { tunnel: 0, duration: rt.reducedMotion ? 0.4 : 1.9, ease: 'power3.out' })
  tl.add(() => unlockScroll())
}

export function openCredits() {
  useStore.getState().set({ creditsOpen: true })
  useStore.getState().markEgg('credits')
  lockScroll()
}
export function closeCredits() {
  useStore.getState().set({ creditsOpen: false })
  if (useStore.getState().selected === null) unlockScroll()
}

export function foundLetter(i: number) {
  const s = useStore.getState()
  if (s.letters[i]) return
  const letters = s.letters.slice()
  letters[i] = true
  s.set({ letters })
  rt.impulse.rgb = Math.max(rt.impulse.rgb, 0.008)
  if (letters.every(Boolean)) {
    rt.impulse.glitch = 1
    s.say('A L T E R C O', 'The walls were spelling it all along.')
    s.markEgg('letters')
  } else {
    s.say('…', 'Some of these tags are not just tags.')
  }
}

export function hoodClick() {
  const s = useStore.getState()
  const n = s.hoodClicks + 1
  s.set({ hoodClicks: n })
  if (n % 7 === 0) {
    // tiny surprise: a photographic-negative flash and an RGB tear
    rt.impulse.glitch = 1
    rt.impulse.rgb = 0.03
    gsap.fromTo(rt.fx, { negative: 1 }, { negative: 0, duration: 0.6, ease: 'steps(5)' })
    s.markEgg('hood')
    s.say('H O O D D I N O', `${alterco.title} · ${dualismo.title} · ${pad(7)}`)
  }
}

const WHISPERS = ['UN ALTRO LATO', 'DUALISMO', 'C’È QUALCUNO', 'ALTER EGO']
/** A rare RGB glitch that reveals a line of hidden text for well under a second. */
export function whisper(text?: string) {
  const s = useStore.getState()
  if (s.whisper) return
  const t = text ?? WHISPERS[Math.floor(Math.random() * WHISPERS.length)]
  rt.impulse.glitch = 1
  rt.impulse.rgb = 0.02
  s.set({ whisper: t })
  s.markEgg('glitch')
  setTimeout(() => useStore.getState().set({ whisper: null }), 620)
}

/** One of the seven numbers, found on a physical object. No counter, no achievement — just a quiet acknowledgement. */
export function foundNumber(i: number) {
  const s = useStore.getState()
  if (s.nums[i]) return
  const nums = s.nums.slice()
  nums[i] = true
  s.set({ nums })
  saveNums(nums)
  s.markEgg(`n${i + 1}`)
  if (i === 4) s.markEgg('stencil')
  rt.impulse.rgb = Math.max(rt.impulse.rgb, 0.006)
  audio.tick()
}
