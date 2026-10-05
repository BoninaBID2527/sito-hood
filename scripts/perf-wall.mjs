// V3.5 — wall-clock frame time for URL variants (headless SwiftShader = relative proxy only, never device FPS).
// usage: node scripts/perf-wall.mjs <WxH> <p> <frames> "quality=balanced" "quality=balanced&scale=0.6" ...
import { chromium } from 'playwright-core'
const [vp, ps, frames, ...variants] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
for (const q of variants) {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1) })).newPage()
  await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&${q}`)
  await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
  await page.click('button:has-text("ENTER")')
  await page.waitForTimeout(6000)
  await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
  await page.addStyleTag({ content: '.overlay{display:none !important}' })
  await page.evaluate((p) => window.__hd.jump(p), Number(ps))
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 300000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const r = await page.evaluate(async (N) => {
    const dts = []; let last = performance.now(), k = 0
    await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) dts.push(n - last); last = n; if (++k >= N + 2) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
    dts.sort((a, b) => a - b)
    return { avg: dts.reduce((s, v) => s + v, 0) / dts.length, med: dts[dts.length >> 1], buf: `${window.__gl.domElement.width}x${window.__gl.domElement.height}`, scale: window.__hd.rt.scale, tier: window.__hd.rt.quality.tier, calls: window.__hd.rt.stats.calls }
  }, Number(frames))
  console.log(`${q.padEnd(40)} avg ${r.avg.toFixed(0).padStart(5)} ms  med ${r.med.toFixed(0).padStart(5)}  buffer ${r.buf} scale ${r.scale.toFixed(2)} tier ${r.tier} calls ${r.calls}`)
  await page.close()
}
await browser.close()
