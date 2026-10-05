// V3.6 — persistent capture daemon: one browser session, commands are JSON files, so a visual iteration costs seconds, not a page load.
// usage: node scripts/shotd.mjs <outDir> <WxH> <quality> [dsf]      env: PORT TOUCH=1 DIR=<command dir>
//   commands are written by scripts/shotc.mjs (steps: jump, cam, camOff, shot, eval, act, wait, settle, cp, reload)
import { chromium } from 'playwright-core'
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { runCheckpoint, CHECKPOINTS } from './qa36-lib.mjs'
const [out = 'shots-d', vp = '1280x720', quality = 'high', dsf = '1'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const DIR = process.env.DIR || out
mkdirSync(out, { recursive: true }); mkdirSync(DIR, { recursive: true })
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(dsf), hasTouch: touch, isMobile: touch })
let page, errors = []
const boot = async () => {
  if (page) await page.close().catch(() => {})
  page = await ctx.newPage(); errors = []
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/KHR_parallel|GPU stall|ReadPixels/.test(m.text()) && errors.push(m.text().slice(0, 240)))
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`)
  await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
  await page.click('button:has-text("ENTER")')
  await page.waitForTimeout(6000)
  if (process.env.FAST !== '1') await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
  await page.addStyleTag({ content: '.overlay{display:none !important}' })
}
await boot()
const until = (fn, arg, to = 120000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => log.push('timeout ' + String(fn).slice(0, 60)))
let log = []
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) })
const step = async (s) => {
  switch (s.op) {
    case 'jump': await page.evaluate((p) => { window.__hd.jump(p); window.__hd.rt.snapSpring = p }, s.p); await settle(); break
    case 'cam': await page.evaluate((c) => { window.__hd.rt.camOverride = c }, { pos: s.pos, look: s.look, fov: s.fov }); break
    case 'camOff': await page.evaluate(() => { window.__hd.rt.camOverride = null }); break
    case 'wait': await page.waitForTimeout(s.ms); break
    case 'settle': await settle(); break
    case 'shot': await page.waitForTimeout(s.wait ?? 1500); await page.screenshot({ path: `${out}/${s.name}.png` }); log.push('shot ' + s.name); break
    case 'eval': log.push('eval ' + JSON.stringify(await page.evaluate(s.js))); break
    case 'act': await page.evaluate(([n, a]) => { const h = window.__hd; return ((h.act))(n, ...a) }, [s.name, s.args ?? []]); break
    case 'cp': { const cp = CHECKPOINTS.find((c) => String(c.n) === String(s.n)); if (!cp) { log.push('no checkpoint ' + s.n); break } await runCheckpoint(page, cp, out, { until, settle, log }); break }
    case 'reload': await boot(); log.push('reloaded'); break
    default: log.push('unknown op ' + s.op)
  }
}
console.log('daemon ready', out, DIR)
writeFileSync(`${DIR}/ready`, String(Date.now()))
for (;;) {
  await new Promise((r) => setTimeout(r, 300))
  const f = `${DIR}/cmd.json`
  if (!existsSync(f)) continue
  let steps
  try { steps = JSON.parse(readFileSync(f, 'utf8')) } catch { continue }
  unlinkSync(f)
  log = []
  const t0 = Date.now()
  // a code edit can make Fast Refresh reload the page (back to the ENTER screen): get back into the experience first
  const entered = await page.evaluate(() => !!window.__hd && window.__hd.store.getState().phase === 'entered').catch(() => false)
  if (!entered) { await boot(); log.push('(page had been reloaded: re-entered)') }
  try { for (const s of steps) { if (s.op === 'quit') { await browser.close(); process.exit(0) } await step(s) } } catch (e) { log.push('ERROR ' + String(e).slice(0, 300)) }
  log.push(`errors: ${errors.length ? [...new Set(errors)].join(' | ') : 'none'}`); errors = []
  log.push(`took ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  writeFileSync(`${DIR}/done.json`, JSON.stringify(log))
}
