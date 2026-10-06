// temporary debug helper: for checkpoint 3, hide each shader/transparent object in turn and count near-white pixels in the speckle region
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { runCheckpoint, CHECKPOINTS } from './qa36-lib.mjs'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await page.goto(`http://localhost:3000/?debug=1&quality=high`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const until = (fn, arg, to = 120000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => {})
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 })
const cp = CHECKPOINTS.find((c) => c.n === 3)
await runCheckpoint(page, { ...cp, name: 'sp-base' }, out, { until, settle, log: [] })
const settleFrames = () => page.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k > 8 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }))
const bright = async () => {
  const buf = await page.screenshot({ clip: { x: 700, y: 520, width: 500, height: 200 } })
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  let c = 0
  for (let p = 0; p < data.length; p += info.channels) if (data[p] > 225 && data[p + 1] > 225 && data[p + 2] > 215) c++
  return c
}
const avg = async () => { let a = 0; for (let k = 0; k < 3; k++) { a += await bright(); await settleFrames() } return Math.round(a / 3) }
console.log('base', await avg())
const T = [
  ['grain0', () => { window.__hd.rt.quality.grain = 0 }],
  ['bloom0', () => { window.__hd.rt.quality.bloom = 0 }],
  ['reflector off', () => { window.__hd.rt.quality.reflector = false }],
  ['shadow0', () => { window.__hd.rt.quality.shadow = 0 }],
]
for (const [n, f] of T) { await page.evaluate(f); await settleFrames(); console.log(n, await avg()) }
await page.screenshot({ path: out + '/after-all.png' })
await browser.close()
