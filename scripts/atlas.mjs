// Dumps the street-typography atlases to PNG (dev aid): node scripts/atlas.mjs <outDir> [quality]
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const [out = 'atlas', quality = 'high'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage()
const errs = []; page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text().slice(0, 300))); page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`http://localhost:3000/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 240000 })
for (const k of ['spray', 'paper']) {
  const url = await page.evaluate((k) => window.__hd.A.graf[k].canvas.toDataURL('image/png'), k)
  writeFileSync(`${out}/${k}.png`, Buffer.from(url.split(',')[1], 'base64'))
}
const cells = await page.evaluate(() => ({ spr: Object.keys(window.__hd.A.graf.spr).length, pap: Object.keys(window.__hd.A.graf.pap).length, sprDim: [window.__hd.A.graf.spray.canvas.width, window.__hd.A.graf.spray.canvas.height] }))
console.log(JSON.stringify(cells))
console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors/warnings')
await browser.close()
