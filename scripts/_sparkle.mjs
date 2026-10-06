// temporary debug helper: hide scene categories one at a time at a checkpoint camera and shoot the same crop
import { chromium } from 'playwright-core'
import { CHECKPOINTS } from './qa36-lib.mjs'
const out = process.argv[2], N = Number(process.argv[3] || 8)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await page.goto(`http://localhost:3000/?debug=1&quality=high`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const cp = CHECKPOINTS.find((c) => c.n === N)
await page.evaluate((p) => window.__hd.jump(p), cp.p)
await page.waitForTimeout(8000)
await page.evaluate((c) => { window.__hd.rt.camOverride = c }, cp.cam)
const frames = () => page.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k > 10 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }))
const shot = async (n) => { await frames(); await page.screenshot({ path: `${out}/${n}.png`, clip: { x: 380, y: 440, width: 520, height: 280 } }) }
const cats = {
  base: () => {},
  instanced: () => window.__scene.traverse((o) => { if (o.isInstancedMesh) o.visible = false }),
  towers: () => window.__scene.traverse((o) => { if (o.isMesh && o.material && /Tower/i.test(o.material.constructor.name + (o.material.name || '') + (o.material.customProgramCacheKey ? o.material.customProgramCacheKey() : ''))) o.visible = false }),
  points: () => window.__scene.traverse((o) => { if (o.isPoints || o.isLine || o.isSprite) o.visible = false }),
  lamps: () => window.__scene.traverse((o) => { if (o.isLight) o.visible = false }),
}
for (const [k, f] of Object.entries(cats)) { await page.evaluate(f); await shot(k) }
await browser.close()
