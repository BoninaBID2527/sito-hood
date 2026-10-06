// V3.5 — where do the per-frame heap allocations come from? Uses the V8 sampling heap profiler over a few seconds of steady-state rendering.
// usage: node scripts/perf-alloc.mjs <quality> <p> [seconds]    (run against `next dev` for readable function names)
import { chromium } from 'playwright-core'
const [quality = 'balanced', ps = '0.16', secs = '8'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage()
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(8000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.evaluate((p) => window.__hd.jump(p), Number(ps))
await page.waitForTimeout(6000)
const cdp = await page.context().newCDPSession(page)
await cdp.send('HeapProfiler.enable')
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
const f0 = await page.evaluate(() => window.__gl.info.render.frame)
await page.waitForTimeout(Number(secs) * 1000)
const f1 = await page.evaluate(() => window.__gl.info.render.frame)
const { profile } = await cdp.send('HeapProfiler.stopSampling')
const rows = new Map()
let total = 0
const walk = (n) => {
  const self = n.selfSize
  if (self > 0) { const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-2).join('/').slice(0, 60)}:${cf.lineNumber}`; rows.set(k, (rows.get(k) || 0) + self); total += self }
  n.children.forEach(walk)
}
walk(profile.head)
const frames = Math.max(1, f1 - f0)
console.log(`${quality} p=${ps}: ${frames} frames in ${secs}s, sampled ${(total / 1024).toFixed(0)} KB → ${(total / 1024 / frames).toFixed(1)} KB/frame`)
for (const [k, v] of [...rows].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`${(v / 1024 / frames).toFixed(1).padStart(7)} KB/frame  ${k}`)
await browser.close()
