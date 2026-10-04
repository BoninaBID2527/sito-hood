// THE HOODDINO ROOM — rendering census per room state (same methodology as scripts/census.mjs: counts averaged over many real
// frames; headless software GL → COUNTS ONLY, never FPS). Also reports what stays allocated after leaving the room.
// usage: node scripts/census-room.mjs <quality> [WxH]     env: WEBM=/path/test.webm (stand-in for the mp4 — stock Chromium has no H.264) PORT=3000
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const quality = process.argv[2] || 'high'
const [W, H] = (process.argv[3] || '960x540').split('x').map(Number)
const PORT = process.env.PORT || 3000
const webm = process.env.WEBM ? readFileSync(process.env.WEBM) : null
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const touch = process.env.TOUCH === '1'
const page = await (await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch })).newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/KHR_parallel/.test(m.text()) && errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => errors.push(e.message))
if (webm) await page.route('**/hooddino-studio-arrangiamento.mp4', (r) => r.fulfill({ status: 200, body: webm, headers: { 'content-type': 'video/webm', 'accept-ranges': 'none' } }))
await page.goto(`http://localhost:${PORT}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const until = (fn, arg, to = 300000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => console.log('timeout', String(fn).slice(0, 70)))
const sample = (n = 24) => page.evaluate(async (n) => {
  const rt = window.__hd.rt, g = window.__gl
  const out = { calls: [], tris: [], refl: [] }
  let last = rt.time
  await new Promise((res) => { const f = () => { if (rt.time !== last) { last = rt.time; out.calls.push(rt.stats.calls); out.tris.push(rt.stats.tris); out.refl.push(rt.stats.refl || 0) } if (out.calls.length >= n) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
  const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / a.length)
  return { calls: avg(out.calls), min: Math.min(...out.calls), max: Math.max(...out.calls), tris: avg(out.tris), tex: g.info.memory.textures, geo: g.info.memory.geometries, prog: g.info.programs?.length, world: rt.world, dpr: rt.dpr, tier: rt.quality.tier, buf: [g.domElement.width, g.domElement.height] }
}, n)
const rows = []
const row = async (name) => { const r = await sample(); rows.push([name, r]); console.log(`${name.padEnd(24)} calls ${String(r.calls).padStart(3)} (min ${r.min}, max ${r.max})  tris ${(r.tris / 1000).toFixed(1)}k  tex ${r.tex}  geo ${r.geo}  prog ${r.prog}  world ${r.world}  dpr ${r.dpr}  buf ${r.buf.join('×')}  tier ${r.tier}`) }

await page.evaluate(() => window.__hd.jump(0.1))
await until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.001 })
await page.waitForTimeout(1500)
await row('0 street, before door')
await page.evaluate(() => window.__hd.jump(0.327))
await until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.001 && window.__hd.store.getState().roomLoad >= 1 })
await page.waitForTimeout(2000)
await row('1 street, at the door')
await page.evaluate(() => window.__hd.act('enterRoom'))
await until(() => window.__hd.store.getState().mode === 'room')
await row('ROOM ENTRY (arriving)')
await until(() => Math.abs(window.__hd.room.u) < 0.02)
await page.waitForTimeout(1500)
await row('ROOM IDLE (entry)')
for (const [i, nm] of [[2, 'BIO WALL'], [1, 'WORKSTATION IDLE'], [3, 'LIVE WALL']]) {
  await page.evaluate((i) => window.__hd.act('goStation', i), i)
  await until((i) => Math.abs(window.__hd.room.u - i) < 0.02, i)
  await page.waitForTimeout(1500)
  await row(nm)
}
await page.evaluate(() => window.__hd.act('goStation', 1))
await until(() => Math.abs(window.__hd.room.u - 1) < 0.02)
await page.evaluate(() => window.__hd.act('focusVideo'))
await until(() => window.__hd.room.push > 0.98)
if (webm) await until(() => window.__hd.vid.el && window.__hd.vid.el.currentTime > 0.3 && !window.__hd.vid.el.paused, null, 120000)
await page.waitForTimeout(1500)
await row('VIDEO PLAYING')
console.log('  video', await page.evaluate(() => { const v = window.__hd.vid.el; return v ? { t: +v.currentTime.toFixed(2), paused: v.paused, rs: v.readyState, tex: !!window.__hd.vid.tex } : null }))
await page.evaluate(() => window.__hd.act('closeFocus'))
await until(() => window.__hd.room.push < 0.02)
await page.evaluate(() => window.__hd.act('exitRoom'))
await until(() => window.__hd.store.getState().mode === 'alterco', null, 600000)
await page.waitForTimeout(2500)
await row('2 street, after leaving')
const room = await page.evaluate(() => {
  let n = 0, visible = 0
  window.__scene.traverse((o) => { if (o.type === 'Group' && o.position.x > 1000) { n++; if (o.visible) visible++ } })
  return { roomGroups: n, visibleRoomGroups: visible, world: window.__hd.rt.world, video: window.__hd.vid.el ? { paused: window.__hd.vid.el.paused, src: window.__hd.vid.el.getAttribute('src') } : null, vidTex: !!window.__hd.vid.tex }
})
console.log('after exit:', JSON.stringify(room))
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
console.log('JSON ' + JSON.stringify(rows.map(([n, r]) => [n, r.calls, r.tris, r.tex, r.geo])))
await browser.close()
