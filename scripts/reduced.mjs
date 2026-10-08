// Verifies prefers-reduced-motion behaviour (no pointer parallax / camera sway, simplified transitions).
import { chromium } from './browser.mjs'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:3000/?debug=1&quality=low')
await page.waitForSelector('button:has-text("ENTER ALTERCO")', { timeout: 600000 })
await page.click('button:has-text("ENTER ALTERCO")', { force: true })
await page.waitForTimeout(6000)
const rm = await page.evaluate(() => window.__hd.rt.reducedMotion)
const x0 = await page.evaluate(() => window.__camera.position.x)
await page.mouse.move(1200, 300)
await page.waitForTimeout(5000)
const x1 = await page.evaluate(() => window.__camera.position.x)
console.log('reducedMotion flag:', rm, ' camera Δx with pointer:', (x1 - x0).toFixed(4), x1 - x0 === 0 || Math.abs(x1 - x0) < 0.005 ? 'PASS (no parallax)' : 'FAIL')
await page.evaluate(() => window.__hd.jump(0.7))
await page.waitForTimeout(9000)
await page.screenshot({ path: process.argv[2] || 'reduced.png' })
console.log(errors.length ? 'errors: ' + errors.join('\n') : 'no errors')
await browser.close()
process.exitCode = (!rm || Math.abs(x1 - x0) >= 0.005 || errors.length) ? 1 : 0
