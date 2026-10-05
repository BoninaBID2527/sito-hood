// the finer brick tiles must arrive after ENTER and be swapped into the live textures (no failed uploads, right size)
import { chromium } from 'playwright-core'
const quality = process.argv[2] || 'high'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/KHR_parallel/.test(m.text()) && errors.push(m.text().slice(0, 160)))
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
const w0 = await page.evaluate(() => window.__hd.A.brick.red.map.image.width)
await page.click('button:has-text("ENTER")')
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width > 1024, null, { timeout: 300000, polling: 500 }).catch(() => {})
await page.waitForTimeout(4000)
const w1 = await page.evaluate(() => ({ red: window.__hd.A.brick.red.map.image.width, concrete: window.__hd.A.brick.concrete.map.image.width, bump: window.__hd.A.brick.red.bump.image.width }))
console.log(`quality ${quality}: brick tile at loader ${w0}px → after ENTER ${JSON.stringify(w1)}`, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors')
await browser.close()
