// V3.7 — photographic QA checkpoints: the street journey, the FULL 360° plaza (8 inward views, 8 outward views, all track poses), the
// ROOM swept in every direction, roof, skyline, DUALISMO. UI hidden. Headless software GL: pictures only, never FPS.
import { runCheckpoint as run36, toRoom, toAlley, st } from './qa36-lib.mjs'
export { st }

const C = { x: 0, y: 2.7, z: -102 } // plaza centre (lib/timeline.ts WORLD.plazaCenter)
const ROOM_X = 1200, DOOR_Z = -67
/** room-local (lx, ly, lz) → world */
const rw = (lx, ly, lz) => [ROOM_X + lz, ly, DOOR_Z - lx]
const rc = (cam, look, fov = 50) => ({ pos: rw(...cam), look: rw(...look), fov })
const P = (i) => 0.41 + (i / 6) * 0.185
const S = (pos, look, fov = 50) => ({ pos, look, fov })
const rad = (d) => (d * Math.PI) / 180

const plazaIn = (d, R = 8) => S([-Math.sin(rad(d)) * R, 2.3, C.z + Math.cos(rad(d)) * R], [C.x, 2.6, C.z], 56)
// camera just OUTSIDE the installation (radius 9, clamped inside the plaza) looking OUT at the wall/background of direction d
const plazaOut = (d) => S([Math.max(-10.5, Math.min(10.5, -Math.sin(rad(d)) * 9)), 2.2, Math.max(-114, Math.min(-82, C.z + Math.cos(rad(d)) * 9))], [-Math.sin(rad(d)) * 40, 3.8, C.z + Math.cos(rad(d)) * 40], 60)

export const CHECKPOINTS = [
  // ── street journey (same poses as V3.6 so before/after stay comparable)
  { n: 1, name: 'street-opening', p: 0 },
  { n: 2, name: 'street-hero-facade', p: 0.04, cam: S([0.3, 1.7, 9], [-3, 4.2, 3.5]) },
  { n: 3, name: 'street-medium-facade', p: 0.08, cam: S([0.7, 1.7, 3.2], [-3, 5.6, -7]) },
  { n: 4, name: 'street-window', p: 0.1, cam: S([-0.9, 2.3, 1.4], [-2.9, 5.3, -1.3], 42) },
  { n: 5, name: 'street-doorway', p: 0.1, cam: S([-0.1, 1.5, -0.3], [-2.9, 1.2, -2.65], 45) },
  { n: 6, name: 'street-wet-asphalt', p: 0.2, cam: S([0.4, 1.0, -3], [0.3, 0.0, -14]) },
  { n: 7, name: 'street-kerb-gutter', p: 0.2, cam: S([-1.2, 0.6, -4], [-2.6, 0.05, -10], 45) },
  { n: 8, name: 'street-deep-alley', p: 0.3 },
  { n: 9, name: 'plaza-entrance', p: 0.36 },
  // ── plaza front + the 360° rotation (inward = what is BEHIND the artwork from each side)
  { n: 10, name: 'plaza-front', p: 0.42 },
  ...[0, 45, 90, 135, 180, 225, 270, 315].map((d, i) => ({ n: 11 + i, name: `plaza-in-${String(d).padStart(3, '0')}`, plaza: plazaIn(d) })),
  ...[0, 45, 90, 135, 180, 225, 270, 315].map((d, i) => ({ n: 19 + i, name: `plaza-out-${String(d).padStart(3, '0')}`, plaza: plazaOut(d) })),
  // Stand behind the installation, inside the passage mouth: the artwork must
  // not occlude the background this checkpoint exists to inspect.
  { n: 27, name: 'plaza-far-ahead', plaza: S([2.8, 2.7, -111], [0, 5.5, -146], 50) },
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ n: 28 + i, name: `track-0${i + 1}`, p: P(i), wait: 2600 })),
  // ── roof, skyline
  { n: 35, name: 'roof-wide', p: 0.87, wait: 2200 },
  { n: 36, name: 'roof-hero', p: 0.94, wait: 2200 },
  { n: 37, name: 'skyline', p: 1.0, wait: 2200, cam: null },
  // ── ROOM (room-local poses; camera override works inside the room world)
  { n: 38, name: 'room-01-exterior', room: 'near' },
  { n: 39, name: 'room-02-threshold', roomCam: rc([0, 1.55, -0.9], [0, 1.4, -4], 54) },
  { n: 40, name: 'room-03-entry', room: 'entry' },
  { n: 41, name: 'room-04-workstation-wide', room: 'station', i: 1 },
  { n: 42, name: 'room-05-workstation-medium', roomCam: rc([0.3, 1.4, -6.3], [0.3, 1.05, -8.4], 46) },
  { n: 43, name: 'room-06-workstation-close', roomCam: rc([0.4, 1.22, -7.3], [0.3, 1.05, -8.4], 40) },
  { n: 44, name: 'room-07-monitor', roomCam: rc([0.5, 1.22, -7.6], [0.5, 1.22, -8.3], 36) },
  { n: 45, name: 'room-08-video', room: 'video' },
  { n: 46, name: 'room-09-speaker', roomCam: rc([-0.6, 1.25, -6.9], [-1.5, 1.05, -8.2], 40) },
  { n: 47, name: 'room-10-acoustic', roomCam: rc([-1.0, 1.5, -6.0], [-2.0, 1.6, -8.6], 50) },
  { n: 48, name: 'room-11-desk-floor', roomCam: rc([1.0, 0.55, -6.8], [0.5, 0.2, -8.1], 50) },
  { n: 49, name: 'room-12-cables', roomCam: rc([0.6, 0.6, -7.9], [0.2, 0.5, -8.5], 50) },
  { n: 50, name: 'room-13-bio', room: 'station', i: 2 },
  { n: 51, name: 'room-14-photo-wall', room: 'station', i: 3 },
  { n: 52, name: 'room-15-side-wall', roomCam: rc([2.4, 1.5, -2.5], [-3.2, 1.3, -6.0], 55) },
  { n: 53, name: 'room-16-rear-wall', roomCam: rc([0.0, 1.6, -3.0], [0.2, 1.6, -8.6], 60) },
  { n: 54, name: 'room-17-ceiling', roomCam: rc([0, 1.6, -5.0], [0, 2.85, -6.8], 62) },
  { n: 55, name: 'room-18-floor', roomCam: rc([0.5, 1.7, -4.0], [0, 0, -6.0], 62) },
  { n: 56, name: 'room-19-dark-corner', roomCam: rc([-1.5, 1.5, -5.5], [3.1, 0.8, -1.5], 55) },
  { n: 57, name: 'room-20-exit-view', room: 'station', i: 4 },
  // ── DUALISMO
  { n: 58, name: 'dualism-entry', dual: 'entry' },
  { n: 59, name: 'dualism-wide', dual: 'wide' },
  { n: 60, name: 'dualism-chirone', dual: 'track', t: 0 },
  { n: 61, name: 'dualism-messaggio', dual: 'track', t: 1 },
]

export async function runCheckpoint(page, cp, out, h) {
  const file = `${out}/${String(cp.n).padStart(2, '0')}-${cp.name}.png`
  const shot = async (wait) => { await page.waitForTimeout(wait); if (h.onShot) return h.onShot(cp); await page.screenshot({ path: file, timeout: 240000 }); h.log.push(`shot ${cp.n} ${cp.name}`) }
  if (cp.plaza) {
    await toAlley(page, h)
    await page.evaluate(() => { window.__hd.jump(0.45); window.__hd.rt.snapSpring = 0.45 }); await h.settle()
    await page.evaluate((c) => { window.__hd.rt.camOverride = c }, cp.plaza)
    await shot(2400)
    await page.evaluate(() => { window.__hd.rt.camOverride = null })
    return
  }
  if (cp.roomCam) {
    await toRoom(page, h)
    await page.evaluate(() => window.__hd.act('goStation', 1)); await h.until(() => Math.abs(window.__hd.room.u - 1) < 0.04 && window.__hd.room.push < 0.001)
    await page.evaluate((c) => { window.__hd.rt.camOverride = c }, cp.roomCam)
    await shot(2000)
    await page.evaluate(() => { window.__hd.rt.camOverride = null })
    return
  }
  // everything else: the V3.6 runner (it names files from cp.n/cp.name, so hand it our numbering)
  return run36(page, cp, out, h)
}
