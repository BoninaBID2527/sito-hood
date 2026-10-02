// Headless-browser driver used for development testing (software GL, so FPS is not representative).
// usage: node scripts/shoot.mjs <outDir> <width>x<height> <quality> p1,p2,... [waitMs] [extraQuery]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const [out = 'shots', vp = '1280x720', quality = 'low', plist = '0', wait = '2500', extra = ''] = process.argv.slice(2)
const [w, h] = vp.split('x').map(Number)
mkdirSync(out, { recursive: true })
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))
await page.goto(`http://localhost:3000/?quality=${quality}${extra}`, { waitUntil: 'load' })
await page.waitForSelector('button:has-text("ENTER")', { timeout: 120000 })
await page.screenshot({ path: `${out}/00-loader-ready.png` })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(Number(wait) + 3000)
let i = 1
if (process.env.ACTION) {
  const [name, ...args] = process.env.ACTION.split(':')
  await page.evaluate(([n, a]) => window.__hd.act(n, ...a.map((x) => (isNaN(Number(x)) ? x : Number(x)))), [name, args])
  await page.waitForTimeout(Number(process.env.ACTION_WAIT || 9000))
  for (let k = 0; k < 2; k++) {
    await page.screenshot({ path: `${out}/${String(i++).padStart(2, '0')}-action-${name}.png` })
    await page.waitForTimeout(2500)
  }
}
for (const p of (plist === 'none' ? [] : plist.split(','))) {
  await page.evaluate((p) => window.__hd?.jump(Number(p)), p)
  await page.waitForFunction(() => { const r = window.__hd?.rt; return r && Math.abs(r.smooth - r.progress) < 0.0015 && Math.abs(r.velocity) < 0.002 && Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.1 }, null, { timeout: 90000 }).catch(() => console.log('settle timeout'))
  await page.waitForTimeout(Number(wait))
  const name = `${out}/${String(i++).padStart(2, '0')}-p${p}.png`
  await page.screenshot({ path: name })
  console.log('shot', name)
}
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].slice(0, 25).join('\n') : 'no console errors/warnings')
await browser.close()
