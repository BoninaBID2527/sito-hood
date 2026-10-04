// screenshots at a list of scroll progress values (headless software GL: pictures only).
// usage: node scripts/path-shots.mjs <outDir> <WxH> <quality> <p1,p2,...>   env: PORT TOUCH=1 UI=0 EXTRA
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const [out, vp = '1280x720', quality = 'high', plist = '0.3'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
mkdirSync(out, { recursive: true })
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: Number(process.env.DSF || 1) })).newPage()
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
if (process.env.UI === '0') await page.addStyleTag({ content: '.overlay{display:none !important}' })
for (const p of plist.split(',').map(Number)) {
  await page.evaluate((p) => window.__hd.jump(p), p)
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) }, null, { timeout: 300000 }).catch(() => {})
  await page.waitForTimeout(Number(process.env.WAIT || 2200))
  await page.screenshot({ path: `${out}/p${String(p).padEnd(5, '0')}.png` })
  console.log('shot', p)
}
await browser.close()
