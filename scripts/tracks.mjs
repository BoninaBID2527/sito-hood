// dev check of the track installation: one screenshot per station (and the entry / exit). usage: node scripts/tracks.mjs <outDir> [WxH] [quality]  (UI=1 keeps the DOM UI, TOUCH=1 emulates a phone, URL=…)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const [out = 'shots-tracks', vp = '1280x720', quality = 'balanced'] = process.argv.slice(2)
const [w, h] = vp.split('x').map(Number)
mkdirSync(out, { recursive: true })
const url = process.env.URL || 'http://localhost:3200/'
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })).newPage()
const errors = []
page.on('console', (m) => ['error'].includes(m.type()) && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${url}?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
if (process.env.UI !== '1') await page.addStyleTag({ content: '.overlay{display:none !important}' })
const list = (process.env.STOPS || 'e,0,1,2,3,4,5,6,x').split(',')
const P = (s) => (s === 'e' ? 0.385 : s === 'x' ? 0.63 : 0.41 + (Number(s) / 6) * 0.185)
for (const s of list) {
  await page.evaluate((p) => window.__hd.jump(p), P(s))
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06 }, null, { timeout: 180000 }).catch(() => console.log('settle timeout', s))
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => { const r = window.__hd.rt; return { u: +r.orbit.angle.toFixed(2), front: r.orbit.front, calls: r.stats.calls, tris: r.stats.tris } })
  await page.screenshot({ path: `${out}/st-${s}.png`, timeout: 240000 })
  console.log('shot', s, JSON.stringify(info))
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors')
await browser.close()
