import { chromium } from 'playwright-core'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
await page.goto('http://localhost:3000/?debug=1&quality=high')
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
await page.evaluate(() => window.__hd.jump(0.327))
await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 }, null, { timeout: 200000 })
await page.waitForTimeout(2500)
await page.addStyleTag({ content: '.overlay{display:none!important}' })
for (const [nm, ap, go] of [['a-far', 0, 0], ['b-ap06', 0.6, 0], ['c-stand', 1, 0], ['d-thr', 1, 0.8]]) {
  await page.evaluate(([ap, go]) => { const r = window.__hd.room; r.phase = 'in'; r.ap = ap; r.go = go }, [ap, go])
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${out}/door-${nm}.png` })
}
await browser.close()
