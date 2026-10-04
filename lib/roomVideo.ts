import * as THREE from 'three'
import { useStore } from './store'
import { audio } from './audio'
import { roomMedia } from '@/data/room'

/**
 * The studio video. One <video> element, created lazily and owned here.
 *
 *   outside the room → nothing exists (no element, no network, no decode)
 *   approaching      → `prepareVideo()` creates the element with preload="none"; only the poster is used by the scene
 *   PLAY (gesture)   → src is attached, play() is called synchronously inside the click/tap handler (Safari/iOS requirement),
 *                      audio is on because the visitor asked for it; the scene shows a THREE.VideoTexture
 *   CLOSE / EXIT     → pause; on exit `releaseVideo()` also drops the source and the texture so nothing is decoded or held
 *
 * `playsinline` keeps iPhone from taking the video fullscreen. `?roomvideo=dom` (or `vid.mode = 'dom'`) shows the same element in a
 * DOM frame over the room instead of on the 3D monitor — the visually coherent fallback if the WebGL video texture misbehaves on a device.
 * A source that cannot be loaded/decoded leaves the poster on the monitor and offers the file as a plain link.
 */
export const vid = {
  el: null as HTMLVideoElement | null,
  tex: null as THREE.VideoTexture | null,
  mode: 'texture' as 'texture' | 'dom',
  attached: false,
  /** the 3D monitor shows the live frame (true while playing / paused mid-video) */
  live: false,
  listeners: [] as (() => void)[],
}

const set = (p: Partial<ReturnType<typeof useStore.getState>>) => useStore.getState().set(p)

export function videoMode() {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('roomvideo') === 'dom') return 'dom'
  return vid.mode
}

function ensure() {
  if (vid.el) return vid.el
  const v = document.createElement('video')
  v.preload = 'none'
  v.playsInline = true
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  v.disablePictureInPicture = true
  v.controls = false
  v.loop = false
  v.muted = false
  v.setAttribute('aria-label', 'HOODDINO — in the studio, arrangement (video)')
  v.className = 'room-video-el'
  const on = (ev: string, fn: () => void) => { v.addEventListener(ev, fn); vid.listeners.push(() => v.removeEventListener(ev, fn)) }
  on('loadstart', () => { if (useStore.getState().video === 'idle') set({ video: 'loading' }) })
  on('waiting', () => { if (!v.paused) set({ video: 'loading' }) })
  on('canplay', () => { if (useStore.getState().video === 'loading') set({ video: v.paused ? 'ready' : 'playing' }) })
  on('playing', () => { set({ video: 'playing' }); audio.duck(true) })
  on('pause', () => { if (!v.ended && useStore.getState().video !== 'idle') set({ video: 'paused' }); audio.duck(false) })
  on('ended', () => { set({ video: 'ended', videoTime: roomMedia.videoDuration }); audio.duck(false) })
  on('timeupdate', () => {
    const t = Math.floor(v.currentTime)
    if (t !== useStore.getState().videoTime) set({ videoTime: t })
  })
  on('error', () => { set({ video: 'error' }); audio.duck(false) })
  vid.el = v
  return v
}

/** approach: create the element (still no network traffic) */
export function prepareVideo() {
  ensure()
}

function attach() {
  const v = ensure()
  if (!vid.attached) {
    v.preload = 'auto'
    v.src = roomMedia.video
    vid.attached = true
  }
  return v
}

/** the three.js texture for the monitor (created on first PLAY, disposed on exit) */
export function videoTexture() {
  if (vid.tex || !vid.el || videoMode() === 'dom') return vid.tex
  const t = new THREE.VideoTexture(vid.el)
  t.colorSpace = THREE.SRGBColorSpace
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = false
  vid.tex = t
  return t
}

/** MUST be called from a user gesture (click / tap / key) — play() and the audio are only permitted because of it */
export function playVideo() {
  const v = attach()
  if (useStore.getState().video === 'ended') v.currentTime = 0
  videoTexture()
  vid.live = true
  v.muted = useStore.getState().videoMuted
  set({ video: v.readyState >= 3 ? 'playing' : 'loading' })
  const p = v.play()
  if (p && typeof p.catch === 'function') {
    p.catch((e: unknown) => {
      // autoplay policy / unsupported source → surface it, keep the controls usable
      if ((e as { name?: string })?.name === 'NotAllowedError') set({ video: 'paused' })
      else set({ video: 'error' })
    })
  }
}

export function pauseVideo() {
  vid.el?.pause()
}

export function toggleVideo() {
  const s = useStore.getState().video
  if (s === 'playing' || s === 'loading') pauseVideo()
  else playVideo()
}

export function setVideoMuted(m: boolean) {
  set({ videoMuted: m })
  if (vid.el) vid.el.muted = m
}

/** CLOSE: pause, keep the frame (the monitor falls back to the poster) */
export function closeVideo() {
  pauseVideo()
  vid.live = false
  set({ video: 'idle', videoTime: 0 })
  if (vid.el) vid.el.currentTime = 0
}

/** exit / leaving the room: nothing keeps decoding and nothing stays allocated for the video */
export function releaseVideo() {
  const v = vid.el
  if (v) {
    v.pause()
    v.removeAttribute('src')
    v.load()
    v.preload = 'none'
  }
  vid.attached = false
  vid.live = false
  vid.tex?.dispose()
  vid.tex = null
  audio.duck(false)
  set({ video: 'idle', videoTime: 0 })
}

export const videoReady = () => !!vid.el
