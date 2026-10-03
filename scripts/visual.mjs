// dev visual check of the quiet secrets (scene only, UI hidden). usage: node scripts/visual.mjs <outDir>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const out = process.argv[2] || 'shots-visual'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:3000/?debug=1&quality=high')
await page.waitForSelector('button:has-text("ENTER")', { timeout: 180000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
await page.addStyleTag({ content: 'body *:not(canvas):not(:has(canvas)){visibility:hidden !important}' })
const settle = () => page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 120000 }).catch(() => console.log('settle timeout'))
const jump = async (p) => { await page.evaluate((p) => window.__hd.jump(p), p); await settle() }
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png`, timeout: 180000 }); console.log('shot', n) }
const ONLY = process.env.ONLY || ''
if (ONLY !== 'sign') {
// 1. impossible puddle (before / during a touch)
await jump(0.25); await page.waitForTimeout(3000); await shot('puddle-a')
await page.evaluate(() => { const s = window.__hd.store.getState(); void s })
}
// 2. sign: dark, then 7/7 lit
await page.evaluate(() => window.__hd.store.getState().set({ nums: new Array(7).fill(false) }))
await jump(1.0); await page.waitForTimeout(3000); await shot('sign-dark')
await page.evaluate(() => window.__hd.store.getState().set({ nums: new Array(7).fill(true) }))
await page.waitForTimeout(24000); await shot('sign-lit')
if (ONLY === 'sign') { await browser.close(); console.log('done'); process.exit(0) }
// 3. DUALISMO
await page.evaluate(() => window.__hd.act('enterDualism'))
await page.waitForFunction(() => window.__hd.rt.world === 'dualism' && window.__hd.rt.dual.t > 0.95, null, { timeout: 180000 }).catch(() => console.log('dual timeout'))
await page.waitForTimeout(4000); await shot('dualismo')
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors')
await browser.close()
