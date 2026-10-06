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
const hideBy = (pred) => () => { window.__scene.traverse((o) => { if (o.isMesh && pred(o)) o.visible = false }) }
const cands = await page.evaluate(() => { const l = []; window.__scene.traverse((o) => { if (o.isMesh && o.visible && (o.receiveShadow || (o.material && o.material.metalness === 0.3 && o.material.vertexColors))) l.push({ uuid: o.uuid, n: o.geometry.attributes.position.count, rs: o.receiveShadow, c: o.material.color && o.material.color.getHexString() }) }); return l })
console.log(JSON.stringify(cands))
const variants = { base: () => {} }
cands.forEach((c, i) => { variants['hide' + i] = (u) => { window.__scene.traverse((o) => { if (o.uuid === u) o.visible = false }) } ; variants['hide' + i].arg = c.uuid })
for (const [k, f] of Object.entries(variants)) {
  await page.evaluate(f, f.arg)
  if (f.arg) { }
  await runCheckpoint(page, { ...cp, name: 'sp-' + k }, out, { until, settle, log: [] })
  if (f.arg) await page.evaluate((u) => { window.__scene.traverse((o) => { if (o.uuid === u) o.visible = true }) }, f.arg)
}
await browser.close()
