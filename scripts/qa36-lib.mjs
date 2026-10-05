// V3.6 — the 36 comparable photographic checkpoints. Street close-ups use an exact camera pose (rt.camOverride, ?debug only) so
// the PR #5 baseline and the V3.6 result are shot from the SAME place; the journey shots use the authored path (jump p).
const P = (i) => 0.41 + (i / 6) * 0.185 // track stations
const C = (pos, look, fov = 50) => ({ pos, look, fov })
export const CHECKPOINTS = [
  { n: 1, name: 'opening-street', p: 0 },
  { n: 2, name: 'hero-facade-near', p: 0.04, cam: C([0.3, 1.7, 9], [-3, 4.2, 3.5]) },
  { n: 3, name: 'hero-facade-medium', p: 0.08, cam: C([0.7, 1.7, 3.2], [-3, 5.6, -7]) },
  { n: 4, name: 'hero-window', p: 0.1, cam: C([-0.9, 2.3, 1.4], [-2.9, 5.3, -1.3], 42) },
  { n: 5, name: 'door-threshold', p: 0.1, cam: C([-0.1, 1.5, -0.3], [-2.9, 1.2, -2.65], 45) },
  { n: 6, name: 'fire-escape-utility', p: 0.2, cam: C([0.9, 2.0, -8], [-3.4, 5.6, -15], 50) },
  { n: 7, name: 'wet-asphalt', p: 0.2, cam: C([0.4, 1.0, -3], [0.3, 0.0, -14], 50) },
  { n: 8, name: 'curb-gutter', p: 0.2, cam: C([-1.2, 0.6, -4], [-2.6, 0.05, -10], 45) },
  { n: 9, name: 'puddle', p: 0.3, cam: C([0.5, 1.1, -12], [0.0, 0.0, -21], 48) },
  { n: 10, name: 'mid-alley', p: 0.16 },
  { n: 11, name: 'deep-alley', p: 0.3 },
  { n: 12, name: 'room-exterior-entrance', room: 'near' },
  { n: 13, name: 'track-plaza-wide', p: 0.385 },
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ n: 14 + i, name: `track-0${i + 1}`, p: P(i), wait: 2600 })),
  { n: 21, name: 'alterco-transition', p: 0.69, wait: 1200 },
  { n: 22, name: 'rooftop-entry', p: 0.76, wait: 2200 },
  { n: 23, name: 'rooftop-wide', p: 0.87, wait: 2200 },
  { n: 24, name: 'rooftop-hero-installation', p: 0.94, wait: 2200 },
  { n: 25, name: 'skyline', p: 1.0, wait: 2200, cam: null },
  { n: 26, name: 'room-entry', room: 'entry' },
  { n: 27, name: 'room-workstation', room: 'station', i: 1 },
  { n: 28, name: 'who-is-hooddino', room: 'station', i: 2 },
  { n: 29, name: 'live-photo-wall', room: 'station', i: 3 },
  { n: 30, name: 'room-video', room: 'video' },
  { n: 31, name: 'dualism-transition', dual: 'transition' },
  { n: 32, name: 'dualism-entry', dual: 'entry' },
  { n: 33, name: 'dualism-wide', dual: 'wide' },
  { n: 34, name: 'chirone', dual: 'track', t: 0 },
  { n: 35, name: 'messaggio', dual: 'track', t: 1 },
  { n: 36, name: 'dualism-return', dual: 'return' },
]

const st = (page) => page.evaluate(() => ({ mode: window.__hd.store.getState().mode, world: window.__hd.rt.world, roomNear: window.__hd.store.getState().roomNear, roomLoad: window.__hd.store.getState().roomLoad }))

async function toAlley(page, h) {
  await page.evaluate(() => { window.__hd.rt.camOverride = null })
  let s = await st(page)
  if (s.mode === 'room' || s.mode === 'room-in' || s.mode === 'room-out') {
    await page.evaluate(() => { try { window.__hd.act('closeFocus') } catch {} ; window.__hd.act('exitRoom') })
    await h.until(() => window.__hd.store.getState().mode === 'alterco', null, 600000)
  }
  s = await st(page)
  if (s.world === 'dualism') {
    await page.evaluate(() => window.__hd.act('exitDualism'))
    await h.until(() => window.__hd.store.getState().mode === 'alterco', null, 600000)
  }
}
async function toRoom(page, h) {
  const s = await st(page)
  if (s.mode === 'room') return
  await toAlley(page, h)
  await page.evaluate((p) => window.__hd.jump(p), 0.327); await h.settle()
  await h.until(() => window.__hd.store.getState().roomNear && window.__hd.store.getState().roomLoad >= 1)
  await page.evaluate(() => window.__hd.act('enterRoom'))
  await h.until(() => window.__hd.store.getState().mode === 'room', null, 300000)
  await h.until(() => Math.abs(window.__hd.room.u) < 0.03)
}
async function toDualism(page, h) {
  const s = await st(page)
  if (s.world === 'dualism') return
  await toAlley(page, h)
  await page.evaluate((p) => window.__hd.jump(p), 0.3); await h.settle()
  await page.evaluate(() => window.__hd.act('enterDualism'))
}

export async function runCheckpoint(page, cp, out, h) {
  const shot = async (wait = 1800) => { await page.waitForTimeout(cp.wait ?? wait); await page.screenshot({ path: `${out}/${String(cp.n).padStart(2, '0')}-${cp.name}.png`, timeout: 240000 }); h.log.push(`shot ${cp.n} ${cp.name}`) }
  if (cp.room) {
    if (cp.room === 'near') {
      await toAlley(page, h)
      await page.evaluate((p) => window.__hd.jump(p), 0.327); await h.settle()
      await h.until(() => window.__hd.store.getState().roomNear && window.__hd.store.getState().roomLoad >= 1)
      return shot(1500)
    }
    await toRoom(page, h)
    if (cp.room === 'entry') { await page.evaluate(() => window.__hd.act('goStation', 0)); await h.until(() => Math.abs(window.__hd.room.u) < 0.04); return shot(1500) }
    if (cp.room === 'station') { await page.evaluate((i) => window.__hd.act('goStation', i), cp.i); await h.until((i) => Math.abs(window.__hd.room.u - i) < 0.04, cp.i); return shot(1500) }
    if (cp.room === 'video') {
      await page.evaluate(() => window.__hd.act('goStation', 1)); await h.until(() => Math.abs(window.__hd.room.u - 1) < 0.04)
      await page.evaluate(() => window.__hd.act('focusVideo')); await h.until(() => window.__hd.room.push > 0.97)
      return shot(2500)
    }
  }
  if (cp.dual) {
    if (cp.dual === 'transition') { await toAlley(page, h); await page.evaluate((p) => window.__hd.jump(p), 0.3); await h.settle(); await page.evaluate(() => window.__hd.act('enterDualism')); await page.waitForTimeout(900); return shot(100) }
    await toDualism(page, h)
    await h.until(() => window.__hd.rt.world === 'dualism')
    if (cp.dual === 'entry') return shot(500)
    await h.until(() => window.__hd.rt.dual.t > 0.98)
    if (cp.dual === 'wide') return shot(2500)
    if (cp.dual === 'track') { await page.evaluate((t) => window.__hd.store.getState().set({ dualismoTrack: t }), cp.t); await shot(4000); await page.evaluate(() => window.__hd.store.getState().set({ dualismoTrack: null })); return }
    if (cp.dual === 'return') { await page.evaluate(() => window.__hd.act('exitDualism')); await h.until(() => window.__hd.store.getState().mode === 'alterco', null, 600000); return shot(2500) }
  }
  await toAlley(page, h)
  await page.evaluate((p) => { window.__hd.jump(p); window.__hd.rt.snapSpring = p }, cp.p); await h.settle()
  if (cp.cam) await page.evaluate((c) => { window.__hd.rt.camOverride = c }, cp.cam)
  await shot(cp.cam ? 2200 : 1800)
  await page.evaluate(() => { window.__hd.rt.camOverride = null })
}
