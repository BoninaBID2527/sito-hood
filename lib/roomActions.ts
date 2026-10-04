import gsap from 'gsap'
import { rt } from './runtime'
import { useStore } from './store'
import { goTo, lockScroll, unlockScroll, scroll } from './scroll'
import { audio } from './audio'
import { room, STATIONS } from './room'
import { closeVideo, pauseVideo, playVideo, prepareVideo, releaseVideo, setVideoMuted, toggleVideo } from './roomVideo'
import { roomLinks, type RoomLinkId } from '@/data/room'

/**
 * THE HOODDINO ROOM — story actions (UI, the 3D scene and the URL all call these).
 *
 * The whole visit is ONE camera move: street pose → stand at the door (the leaf opens) → through the aperture → [the world swaps
 * while the dark vestibule fills the frame — the same trick as the rest of the site, no page cut] → entry station.
 * Leaving replays it backwards and ends on the exact street pose the visitor left (the scroll position is never touched).
 */

/** scroll progress at which the camera has the door in view, ahead on the left (alley, just before the plaza) */
export const DOOR_P = 0.327

const sleep = (s: number) => new Promise<void>((r) => gsap.delayedCall(s, r))
/** resolves once cond() holds or `timeout` seconds of *simulation* time have passed (works at any frame rate) */
const until = (cond: () => boolean, timeout = 12) =>
  new Promise<void>((res) => {
    const t0 = rt.time
    const tick = () => {
      if (cond() || rt.time - t0 > timeout) { gsap.ticker.remove(tick); res() }
    }
    gsap.ticker.add(tick)
  })
const tweenTo = <T extends object>(o: T, vars: gsap.TweenVars) => gsap.to(o, vars).then()
const fade = (to: number, d: number) => (rt.reducedMotion ? gsap.to(rt.fx, { fade: to, duration: 0.12 }).then() : gsap.to(rt.fx, { fade: to, duration: d, ease: 'power2.inOut' }).then())

/** background load: JS chunk is requested by <World> when this flag flips; shell textures + the video element are prepared here */
let shellPromise: Promise<void> | null = null
export function warmRoom() {
  if (!shellPromise) {
    shellPromise = import('./roomTextures')
      .then((m) => m.loadRoomShell())
      .then(() => { if (useStore.getState().roomLoad < 1) useStore.getState().set({ roomLoad: 1 }) })
      .catch(() => undefined)
  }
  prepareVideo()
  return shellPromise
}
let detailPromise: Promise<void> | null = null
export function loadDetail() {
  if (!detailPromise) {
    detailPromise = warmRoom()
      .then(() => import('./roomTextures'))
      .then((m) => m.loadRoomDetail())
      .then(() => useStore.getState().set({ roomLoad: 2 }))
      .catch(() => undefined)
  }
  return detailPromise
}

/** the room scene reports it is mounted + compiled */
export const roomScene = { mounted: false }

export async function enterRoom(opts: { direct?: boolean } = {}) {
  const s = useStore.getState()
  if (s.phase !== 'entered' || s.mode !== 'alterco' || room.phase !== 'off') return
  s.set({ mode: 'room-in', selected: null, menu: false })
  room.phase = 'in'
  room.exiting = false
  lockScroll()
  audio.thud()

  // bring the camera to the door's neighbourhood (menu / URL entries start elsewhere in the journey)
  if (!room.near) {
    if (opts.direct) {
      const y = DOOR_P * scroll.max()
      scroll.lenis ? scroll.lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)
      rt.progress = DOOR_P
    } else goTo(DOOR_P, { duration: 2.4 })
    await until(() => Math.abs(rt.smooth - DOOR_P) < 0.006 && Math.abs(rt.velocity) < 0.02, 10)
    lockScroll()
  }

  // everything the room needs is requested the moment the visitor commits; the walk to the door hides the work
  warmRoom()
  const detail = loadDetail()
  room.warm = true
  const slow = rt.reducedMotion ? 0.3 : 1
  await tweenTo(room, { ap: 1, duration: 1.7 * slow, ease: 'power2.inOut' })
  audio.thud()
  await tweenTo(room, { go: 1, duration: 1.35 * slow, ease: 'power1.in' })

  // inside the dark vestibule: wait (briefly) for the room to be ready, then swap worlds behind a short dip
  await Promise.race([Promise.all([shellPromise, detail, until(() => roomScene.mounted, 10)]), sleep(7)])
  await fade(0, 0.2)
  room.warm = false
  room.u = -1
  room.uT = 0
  room.push = room.pushT = 0
  room.inside = true
  room.phase = 'inside'
  useStore.getState().set({ mode: 'room', roomStation: 0, roomFocus: false })
  // the first room frames compile the room's shaders: stay black until they have been drawn
  const t0 = rt.time
  await until(() => rt.time - t0 >= 0.12, 6)
  await fade(1, 0.75)
}

export function goStation(i: number) {
  const s = useStore.getState()
  if (s.mode !== 'room') return
  const n = Math.max(0, Math.min(STATIONS.length - 1, Math.round(i)))
  if (s.roomFocus) closeFocus()
  room.uT = n
  useStore.getState().set({ roomStation: n })
}
export const nextStation = () => goStation(room.uT + 1)
export const prevStation = () => goStation(room.uT - 1)

/** PLAY on the workstation: the camera pushes in, the room lowers its lights, the video starts (called from a gesture) */
export function focusVideo() {
  const s = useStore.getState()
  if (s.mode !== 'room') return
  room.uT = 1
  room.pushT = 1
  s.set({ roomFocus: true, roomStation: 1 })
  playVideo() // synchronous: the click that got us here is the permission to start picture and sound
}
export function toggleFocusedVideo() {
  toggleVideo()
}
/** CLOSE: pause, camera and lights back to the workstation shot */
export function closeFocus() {
  room.pushT = 0
  useStore.getState().set({ roomFocus: false })
  closeVideo()
}
export function setSound(on: boolean) {
  setVideoMuted(!on)
}

export async function exitRoom() {
  const s = useStore.getState()
  if (s.mode !== 'room') return
  pauseVideo()
  s.set({ mode: 'room-out', roomFocus: false })
  room.pushT = 0
  room.exiting = true
  room.uT = 5
  audio.thud()
  await until(() => room.u > 4.8, 10)
  await fade(0, 0.2)
  room.inside = false
  room.u = -1
  releaseVideo()
  await fade(1, 0.6)
  const slow = rt.reducedMotion ? 0.3 : 1
  await tweenTo(room, { go: 0, duration: 1.2 * slow, ease: 'power1.out' })
  await tweenTo(room, { ap: 0, duration: 1.5 * slow, ease: 'power2.inOut' })
  room.phase = 'off'
  room.exiting = false
  useStore.getState().set({ mode: 'alterco', roomFocus: false })
  unlockScroll()
}

export function openLink(id: RoomLinkId) {
  window.open(roomLinks[id].url, '_blank', 'noopener,noreferrer')
}
