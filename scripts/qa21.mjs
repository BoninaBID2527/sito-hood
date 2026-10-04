// V3.4 — the 21 visual QA checkpoints (headless software GL: pictures only, never FPS).
// usage: node scripts/qa21.mjs <outDir> <WxH> <quality> [steps]    env: PORT=3000 TOUCH=1 WEBM=/path/test.webm EXTRA='&x=1' UI=0 (hide DOM overlay)
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
const [out = 'shots-qa', vp = '1280x720', quality = 'high', steps = 'street,tracks,transition,roof,room,dualism'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const S = new Set(steps.split(','))
mkdirSync(out, { recursive: true })
const touch = process.env.TOUCH === '1'
const webm = process.env.WEBM ? readFileSync(process.env.WEBM) : null
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: touch, isMobile: touch })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/KHR_parallel/.test(m.text()) && errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => errors.push(e.message))
if (webm) await page.route('**/hooddino-studio-arrangiamento.mp4', (r) => r.fulfill({ status: 200, body: webm, headers: { 'content-type': 'video/webm', 'accept-ranges': 'none' } }))
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
if (process.env.UI === '0') await page.addStyleTag({ content: '.overlay{display:none !important}' })
const until = (fn, arg, to = 300000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => console.log('timeout', String(fn).slice(0, 70)))
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) })
const jump = async (p) => { await page.evaluate((p) => window.__hd.jump(p), p); await settle() }
const shot = async (n, name, wait = 1800) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}.png` }); console.log('shot', n, name) }
const P = (i) => 0.41 + (i / 6) * 0.185
if (S.has('street')) {
  await jump(0.0); await shot(1, 'opening')
  await jump(0.16); await shot(2, 'mid-alley')
  await jump(0.3); await shot(3, 'deep-alley')
}
if (S.has('tracks')) {
  await jump(0.385); await shot(4, 'track-area-wide')
  for (const [n, i] of [[5, 0], [6, 2], [7, 4], [8, 6]]) { await jump(P(i)); await shot(n, `track-0${i + 1}`, 2600) }
}
if (S.has('transition')) { await jump(0.69); await shot(9, 'alterco-transition', 1200) }
if (S.has('roof')) { await jump(0.9); await shot(10, 'rooftop', 2500) }
if (S.has('room')) {
  await jump(0.327)
  await until(() => window.__hd.store.getState().roomNear && window.__hd.store.getState().roomLoad >= 1)
  await shot(11, 'room-entrance-street', 1500)
  await page.evaluate(() => window.__hd.act('enterRoom'))
  await until(() => window.__hd.room.ap > 0.98)
  await shot(11.5, 'room-door-open', 800)
  await until(() => window.__hd.store.getState().mode === 'room')
  await until(() => Math.abs(window.__hd.room.u) < 0.03)
  await shot(12, 'room-hero', 1500)
  for (const [n, i, nm] of [[13, 1, 'workstation'], [14, 2, 'who-is-hooddino'], [15, 3, 'live-wall']]) {
    await page.evaluate((i) => window.__hd.act('goStation', i), i)
    await until((i) => Math.abs(window.__hd.room.u - i) < 0.04, i)
    await shot(n, nm, 1500)
  }
  await page.evaluate(() => window.__hd.act('goStation', 1))
  await until(() => Math.abs(window.__hd.room.u - 1) < 0.04)
  await page.evaluate(() => window.__hd.act('focusVideo'))
  await until(() => window.__hd.room.push > 0.97)
  if (webm) await until(() => window.__hd.vid.el && window.__hd.vid.el.currentTime > 1, null, 120000)
  await shot(16, 'room-video', 2500)
  await page.evaluate(() => window.__hd.act('closeFocus'))
  await page.evaluate(() => window.__hd.act('exitRoom'))
  await until(() => window.__hd.store.getState().mode === 'alterco', null, 600000)
}
if (S.has('dualism')) {
  await jump(0.3)
  await page.evaluate(() => window.__hd.act('enterDualism'))
  await until(() => window.__hd.rt.world === 'dualism')
  await shot(17, 'dualism-entry', 400)
  await until(() => window.__hd.rt.dual.t > 0.98)
  await shot(18, 'dualism-wide', 2500)
  await page.evaluate(() => window.__hd.store.getState().set({ dualismoTrack: 0 }))
  await shot(19, 'chirone', 4000)
  await page.evaluate(() => window.__hd.store.getState().set({ dualismoTrack: 1 }))
  await shot(20, 'messaggio', 4000)
  await page.evaluate(() => window.__hd.store.getState().set({ dualismoTrack: null }))
  await page.evaluate(() => window.__hd.act('exitDualism'))
  await until(() => window.__hd.store.getState().mode === 'alterco', null, 600000)
  await shot(21, 'dualism-return', 2500)
}
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
await browser.close()
