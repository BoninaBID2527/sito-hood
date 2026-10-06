// V3.7 — run the photographic checkpoints. usage: node scripts/qa37.mjs <outDir> <WxH> <quality> [from-to|n,n,..]
// env: PORT TOUCH=1 DSF=1 WEBM=<test.webm> EXTRA='&…' (query)  NOPOST=1 (QA: disable bloom/grain/vignette to inspect the raw render)
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { runCheckpoint, CHECKPOINTS } from './qa37-lib.mjs'
const [out = 'shots-qa37', vp = '1280x720', quality = 'high', sel = ''] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
mkdirSync(out, { recursive: true })
const want = (n) => { if (!sel) return true; return sel.split(',').some((t) => { const [a, b] = t.split('-').map(Number); return b ? n >= a && n <= b : n === a }) }
const webm = process.env.WEBM ? readFileSync(process.env.WEBM) : null
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: process.env.TOUCH === '1', isMobile: process.env.TOUCH === '1' })).newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/KHR_parallel|GPU stall|ReadPixels/.test(m.text()) && errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => errors.push(e.message))
if (webm) await page.route('**/hooddino-studio-arrangiamento.mp4', (r) => r.fulfill({ status: 200, body: webm, headers: { 'content-type': 'video/webm', 'accept-ranges': 'none' } }))
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => console.log('brick upgrade not seen'))
await page.addStyleTag({ content: '.overlay,.cursor,nextjs-portal{display:none !important}' })
if (process.env.NOPOST === '1') await page.evaluate(() => { const q = window.__hd.rt.quality; q.bloom = 0; q.grain = 0 })
const log = []
const until = (fn, arg, to = 120000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => console.log('timeout', String(fn).slice(0, 70)))
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) })
for (const cp of CHECKPOINTS) { if (!want(cp.n)) continue; await runCheckpoint(page, cp, out, { until, settle, log }); console.log(log.splice(0).join('\n')) }
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
await browser.close()
