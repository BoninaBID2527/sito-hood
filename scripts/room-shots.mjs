// THE HOODDINO ROOM — visual walk-through for development (headless software GL: look at pictures, never at FPS).
// usage: node scripts/room-shots.mjs <outDir> <WxH> <quality> [steps]   (steps: comma list of approach,door,thr,inside,stations,video,exit)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const [out = 'shots-room', vp = '960x540', quality = 'high', steps = 'approach,door,thr,inside,stations,video,exit'] = process.argv.slice(2)
const [w, h] = vp.split('x').map(Number)
const S = new Set(steps.split(','))
mkdirSync(out, { recursive: true })
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: process.env.REDUCED === '1' ? 'reduce' : 'no-preference' })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(`[${m.type()}] ${m.text().slice(0, 240)}`))
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))
page.on('requestfailed', (r) => errors.push('[requestfailed] ' + r.url()))
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`, { waitUntil: 'load' })
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
let n = 0
const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); console.log('shot', name) }
const until = (fn, to = 240000) => page.waitForFunction(fn, null, { timeout: to, polling: 200 }).catch(() => console.log('timeout waiting', String(fn).slice(0, 80)))
const j = (p) => page.evaluate((p) => window.__hd.jump(p), p)
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 })

if (S.has('approach')) {
  await j(0.3); await settle(); await page.waitForTimeout(1200); await shot('street-p030')
  await j(0.327); await settle(); await page.waitForTimeout(2500)
  await until(() => window.__hd.store.getState().roomNear, 60000)
  await shot('street-door-offer')
}
if (S.has('door') || S.has('thr') || S.has('inside')) {
  await page.evaluate(() => window.__hd.act('enterRoom'))
  if (S.has('door')) { await until(() => window.__hd.room.ap > 0.97); await page.waitForTimeout(1000); await shot('at-door') }
  if (S.has('thr')) { await until(() => window.__hd.room.go > 0.55); await shot('threshold-go055'); await until(() => window.__hd.room.go > 0.97); await shot('threshold-go1') }
  await until(() => window.__hd.store.getState().mode === 'room')
  await until(() => Math.abs(window.__hd.room.u - 0) < 0.03, 120000)
  await page.waitForTimeout(1500)
  if (S.has('inside')) await shot('inside-entry')
}
if (S.has('stations')) {
  for (const [i, nm] of [[1, 'workstation'], [2, 'bio'], [3, 'live'], [4, 'exit']]) {
    await page.evaluate((i) => window.__hd.act('goStation', i), i)
    await until((i) => Math.abs(window.__hd.room.u - i) < 0.03, 120000).catch(() => {})
    await page.waitForFunction((i) => Math.abs(window.__hd.room.u - i) < 0.04, i, { timeout: 120000 }).catch(() => console.log('station timeout', i))
    await page.waitForTimeout(1200)
    await shot('station-' + nm)
  }
}
if (S.has('video')) {
  await page.evaluate(() => window.__hd.act('goStation', 1))
  await page.waitForFunction(() => Math.abs(window.__hd.room.u - 1) < 0.04, null, { timeout: 120000 }).catch(() => {})
  await page.evaluate(() => window.__hd.act('focusVideo'))
  await page.waitForFunction(() => window.__hd.room.push > 0.97, null, { timeout: 120000 }).catch(() => console.log('push timeout'))
  await page.waitForTimeout(4000)
  await shot('video-focus')
  console.log('video', await page.evaluate(() => { const v = document.querySelector('video'); return v ? { t: v.currentTime, paused: v.paused, muted: v.muted, rs: v.readyState } : null }))
  await page.evaluate(() => window.__hd.act('closeFocus'))
  await page.waitForFunction(() => window.__hd.room.push < 0.03, null, { timeout: 120000 }).catch(() => {})
  await shot('video-closed')
}
if (S.has('exit')) {
  await page.evaluate(() => window.__hd.act('exitRoom'))
  await until(() => window.__hd.store.getState().mode === 'alterco', 300000)
  await page.waitForTimeout(1500)
  await shot('back-in-street')
  console.log('exit state', await page.evaluate(() => ({ p: window.__hd.rt.progress, sm: window.__hd.rt.smooth, world: window.__hd.rt.world })))
}
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
await browser.close()
