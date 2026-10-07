// V3.6 — relative frame-time probe at given journey progress points (software GL: RELATIVE only). Run alternately against two servers (A,B,A,B…).
// usage: node scripts/perf-ab36.mjs <port> <WxH> <tier> <p1,p2,…>
import { chromium } from './browser.mjs'
const [port = '3000', vp = '960x540', tier = 'high', ps = '0.02,0.16,0.4'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage()
await page.goto(`http://localhost:${port}/?debug=1&quality=${tier}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")', { force: true })
await page.waitForTimeout(8000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280, null, { timeout: 300000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const out = {}
for (const p of ps.split(',').map(Number)) {
  await page.evaluate((p) => { window.__hd.jump(p); if ('snapSpring' in window.__hd.rt) window.__hd.rt.snapSpring = p }, p)
  await page.waitForTimeout(6000)
  out[p] = await page.evaluate(async () => {
    const d = []; let last = performance.now(), k = 0
    await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 2) d.push(n - last); last = n; if (++k >= 12) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
    d.sort((a, b) => a - b); return Math.round(d[d.length >> 1])
  }, p)
}
console.log(port, JSON.stringify(out))
await browser.close()
