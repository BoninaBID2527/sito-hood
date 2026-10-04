// Behaviour checks for the track installation (camera rig, input feel). usage: node scripts/tracks-check.mjs [url] [quality]
import { chromium } from 'playwright-core'
const url = process.argv[2] || 'http://localhost:3000/'
const quality = process.argv[3] || 'balanced'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
let pass = 0, fail = 0
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`) }
const errors = []
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${url}?debug=1&quality=${quality}`)
  await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
  await page.click('button:has-text("ENTER")')
  await page.waitForTimeout(5000)
  return { ctx, page }
}
// headless software GL runs at ~1 fps and the engine clamps dt, so wall-clock waits say nothing about motion: wait in simulation time
const simWait = (page, sec) => page.evaluate((sec) => new Promise((res) => { const t0 = window.__hd.rt.time; const f = () => (window.__hd.rt.time - t0 >= sec ? res() : requestAnimationFrame(f)); f() }), sec)
const P = (i) => 0.41 + (i / 6) * 0.185
const settle = (page) => page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06 }, null, { timeout: 180000 }).catch(() => {})

{
  const { ctx, page } = await open()
  await page.evaluate((p) => window.__hd.jump(p), P(0)); await settle(page)
  // 1. a violent scroll flick from track 01 to track 07: the camera must pass every track, never teleport past several
  await page.evaluate(() => { window.__trace = []; const rt = window.__hd.rt; let last = -1; const f = () => { if (rt.time !== last) { last = rt.time; window.__trace.push([rt.time * 1000, rt.orbit.angle]) } window.__raf = requestAnimationFrame(f) }; f() })
  await page.evaluate((p) => window.__hd.jump(p), P(6))
  await simWait(page, 9)
  const trace = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__trace })
  let maxStep = 0, maxRate = 0
  for (let i = 1; i < trace.length; i++) { const d = Math.abs(trace[i][1] - trace[i - 1][1]); maxStep = Math.max(maxStep, d); maxRate = Math.max(maxRate, d / ((trace[i][0] - trace[i - 1][0]) / 1000)) }
  const final = trace[trace.length - 1][1]
  check('violent scroll flick does not teleport: camera travel rate stays limited', maxRate < 3.2, `max ${maxRate.toFixed(2)} stations/s (limit 2.1 + overshoot)`)
  check('…and it still arrives at track 07', Math.abs(final - 6) < 0.15, `u=${final.toFixed(2)}`)
  const crossed = new Set(trace.map(([, u]) => Math.round(u))).size
  check('…passing through the intermediate tracks', crossed >= 6, `${crossed} stations visited`)
  // 2. magnetic snap: park half-way, release, it settles on a station
  await page.evaluate((p) => window.__hd.jump(p), P(2.5))
  await simWait(page, 7)
  const u2 = await page.evaluate(() => window.__hd.rt.orbit.angle)
  check('magnetic snap: resting between tracks settles on one', Math.abs(u2 - Math.round(u2)) < 0.12, `u=${u2.toFixed(2)}`)
  // 3. vertical gesture does not drag the installation (page scroll keeps it); horizontal does
  await page.evaluate((p) => window.__hd.jump(p), P(3)); await settle(page)
  const d0 = await page.evaluate(() => window.__hd.rt.orbit.drag)
  await page.evaluate(() => { const c = document.querySelector('canvas'); const mk = (t, x, y) => new PointerEvent(t, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }); c.dispatchEvent(mk('pointerdown', 600, 300)); for (let i = 1; i <= 8; i++) window.dispatchEvent(mk('pointermove', 604, 300 + i * 40)); window.dispatchEvent(mk('pointerup', 604, 620)) })
  await page.waitForTimeout(600)
  const d1 = await page.evaluate(() => window.__hd.rt.orbit.drag)
  check('vertical gesture does not drag the installation (belongs to page scroll)', Math.abs(d1 - d0) < 0.02, `Δ=${(d1 - d0).toFixed(3)}`)
  await page.evaluate(() => { const c = document.querySelector('canvas'); const mk = (t, x, y) => new PointerEvent(t, { pointerId: 10, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }); c.dispatchEvent(mk('pointerdown', 900, 300)); for (let i = 1; i <= 8; i++) window.dispatchEvent(mk('pointermove', 900 - i * 40, 304)); window.dispatchEvent(mk('pointerup', 580, 304)) })
  await simWait(page, 5)
  const u3 = await page.evaluate(() => window.__hd.rt.orbit.angle)
  check('horizontal swipe moves the camera on to the next track(s)', u3 > 3.4, `u=${u3.toFixed(2)}`)
  // 4. deep focus: the camera itself moves toward the track
  await page.evaluate((p) => window.__hd.jump(p), P(1)); await settle(page)
  const c0 = await page.evaluate(() => { const c = window.__camera; const l = window.__hd.store.getState(); return [c.position.x, c.position.y, c.position.z] })
  await page.evaluate(() => window.__hd.act('selectTrack', 1))
  await simWait(page, 4)
  const c1 = await page.evaluate(() => { const c = window.__camera; return [c.position.x, c.position.y, c.position.z] })
  const mv = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2])
  check('opening a track moves the CAMERA toward it (not just the object)', mv > 0.9, `moved ${mv.toFixed(2)} m`)
  await page.evaluate(() => window.__hd.act('selectTrack', null))
  await ctx.close()
}
{
  // 5. reduced motion: travel between tracks is short
  const { ctx, page } = await open({ reduced: true })
  await page.evaluate((p) => window.__hd.jump(p), P(0)); await settle(page)
  await page.evaluate((p) => window.__hd.jump(p), P(4))
  const t0 = await page.evaluate(() => window.__hd.rt.time)
  await page.waitForFunction(() => Math.abs(window.__hd.rt.orbit.angle - 4) < 0.1, null, { timeout: 120000 }).catch(() => {})
  const dt = (await page.evaluate(() => window.__hd.rt.time)) - t0
  check('reduced motion: tracks stay reachable and the travel is short (simulation time)', dt < 2.5, `${dt.toFixed(2)} s`)
  await ctx.close()
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors')
console.log(`${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
