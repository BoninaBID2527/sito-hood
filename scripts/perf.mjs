// Draw-call / triangle / GPU-memory census at key points of the journey (software GL: counts only, not FPS).
// usage: node scripts/perf.mjs <quality> p1,p2,...
import { chromium } from 'playwright-core'
const [quality = 'high', plist = '0,0.2,0.4,0.55,0.7,0.8,1'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text().slice(0, 300)))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://localhost:3000/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER ALTERCO")', { timeout: 180000 })
await page.click('button:has-text("ENTER ALTERCO")')
await page.waitForTimeout(6000)
for (const p of plist.split(',')) {
  await page.evaluate((p) => window.__hd.jump(Number(p)), p)
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.002 && Math.abs(r.velocity) < 0.003 }, null, { timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3500)
  const o = await page.evaluate(() => ({ calls: window.__hd.rt.stats.calls, tris: window.__hd.rt.stats.tris, geo: window.__gl.info.memory.geometries, tex: window.__gl.info.memory.textures, prog: window.__gl.info.programs?.length, world: window.__hd.rt.world }))
  console.log(`p=${p}`.padEnd(8), JSON.stringify(o))
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
await browser.close()
