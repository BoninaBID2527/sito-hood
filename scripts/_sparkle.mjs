import { chromium } from 'playwright-core'
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
const variants = {
  base: () => {},
  noShadow: () => { window.__hd.rt.quality.shadow = 0 },
  noWater: () => { window.__scene.traverse((o) => { if (o.type === 'Mesh' && o.onBeforeRender && /reflector/i.test(o.onBeforeRender.toString().slice(0, 400))) o.visible = false }) },
}
for (const [k, f] of Object.entries(variants)) {
  await page.evaluate(f)
  await runCheckpoint(page, { ...cp, name: 'sp-' + k }, out, { until, settle, log: [] })
}
await browser.close()
