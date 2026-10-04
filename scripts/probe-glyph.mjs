import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await page.goto('http://localhost:3000/?debug=1&quality=balanced')
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(4000)
await page.evaluate(() => window.__hd.jump(0.15))
await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 200000 })
await page.waitForTimeout(3000)
console.log(await page.evaluate(() => {
  const c = window.__camera; c.updateMatrixWorld()
  const v = new c.position.constructor(-2.95, 1.2, -33.4).project(c)
  const rc = window.__rc, sc = window.__scene
  const THREE_V2 = rc.ray.origin.constructor
  rc.setFromCamera({ x: v.x, y: v.y }, c)
  const hits = rc.intersectObjects(sc.children, true).slice(0, 6).map((h) => ({ d: +h.distance.toFixed(2), type: h.object.type, name: h.object.name, pos: h.object.getWorldPosition(new THREE_V2().constructor === Object ? undefined : new (c.position.constructor)()).toArray().map((n) => +n.toFixed(1)), vis: h.object.visible, hasClick: !!h.object.__r3f?.handlers?.onClick }))
  return { cam: c.position.toArray().map((n) => +n.toFixed(2)), hits }
}))
await browser.close()
