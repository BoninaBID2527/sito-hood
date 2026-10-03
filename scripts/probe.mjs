// dev probe: what does a ray through a world point hit first? usage: node scripts/probe.mjs p x y z
import { chromium } from 'playwright-core'
const [p, x, y, z] = process.argv.slice(2).map(Number)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await page.goto('http://localhost:3000/?debug=1&quality=low')
await page.waitForSelector('button:has-text("ENTER")', { timeout: 180000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.evaluate((p) => window.__hd.jump(p), p)
await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0015 && Math.abs(r.velocity) < 0.002 }, null, { timeout: 90000 }).catch(() => {})
await page.waitForTimeout(2500)
const out = await page.evaluate(([x, y, z]) => {
  const c = window.__camera, scene = window.__scene
  c.updateMatrixWorld()
  const V = new c.position.constructor(x, y, z)
  const dir = V.clone().sub(c.position).normalize()
  const rc = new window.__rc.constructor(c.position.clone(), dir, 0.1, 200)
  rc.layers.enableAll(); rc.camera = c
  const hits = rc.intersectObjects(scene.children, true).filter((h) => h.object.type !== 'Points' && (h.object.__r3f?.handlers && Object.keys(h.object.__r3f.handlers).length || Math.abs(h.distance - V.distanceTo(c.position)) < 1.2)).slice(0, 8)
  return { cam: c.position.toArray(), dist: V.distanceTo(c.position), hits: hits.map((h) => ({ d: +h.distance.toFixed(2), type: h.object.type, name: h.object.name, geo: h.object.geometry?.type, mat: h.object.material?.type, op: h.object.material?.opacity, hasHandler: !!(h.object.__r3f?.handlers && Object.keys(h.object.__r3f.handlers).length) })) }
}, [x, y, z])
console.log(JSON.stringify(out, null, 1))
await browser.close()
