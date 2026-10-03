// dev check: scene-only screenshots at given progress values (UI hidden). usage: node scripts/anam.mjs <out> p1,p2 [extraQuery]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const [out, plist = '0.165', extra = ''] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage()
const errors = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://localhost:3000/?debug=1&quality=medium${extra}`, { waitUntil: 'load' })
await page.waitForSelector('button:has-text("ENTER")', { timeout: 180000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(4000)
await page.addStyleTag({ content: 'body *:not(canvas):not(:has(canvas)){visibility:hidden !important}' })
for (const p of plist.split(',')) {
  await page.evaluate((p) => window.__hd?.jump(Number(p)), p)
  await page.waitForFunction(() => { const r = window.__hd?.rt; return r && Math.abs(r.smooth - r.progress) < 0.0006 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 120000 }).catch(() => console.log('settle timeout'))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${out}/p${p}.png`, timeout: 180000 })
  console.log('shot', p)
}
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors')
await browser.close()
