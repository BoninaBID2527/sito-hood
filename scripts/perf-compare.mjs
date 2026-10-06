// V3.5 — interleaved A/B of the render configurations in ONE session (headless SwiftShader: a relative, pixel-bound proxy — never device FPS).
//   v3.4   : MSAA 2 on the HDR target, depth resolve on, scale 1            (what a BALANCED tablet ran in V3.4)
//   v3.5   : the V3.5 default for that density (MSAA off at ≥1.5 px/css px, depth resolve off), scale 1
//   v3.5@s : V3.5 default + internal render scale s (what the adaptive manager settles on for a device that is too slow at 1.0)
// usage: node scripts/perf-compare.mjs <WxH css> <DSF> <p> <rounds>     (quality=balanced, pinned)
import { chromium } from 'playwright-core'
const [vp = '512x384', dsf = '2', ps = '0.16', rounds = '3'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(dsf) })).newPage()
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=balanced`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(8000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
await page.evaluate((p) => window.__hd.jump(p), Number(ps))
await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 300000 }).catch(() => {})
await page.waitForTimeout(3000)
const out = await page.evaluate(async (R) => {
  const rt = window.__hd.rt, tgt = window.__post.target
  const measure = async (N = 5) => { const d = []; let last = performance.now(), k = 0; await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) d.push(n - last); last = n; if (++k >= N + 2) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }); d.sort((a, b) => a - b); return d[d.length >> 1] }
  const set = (samples, depth, scale) => { if (tgt.samples !== samples) { tgt.samples = samples; tgt.dispose() } tgt.resolveDepthBuffer = depth; rt.scale = scale }
  const cfgs = { 'v3.4 (msaa2, depth-resolve, 1.0)': [2, true, 1], 'v3.5 default (no msaa, 1.0)': [0, false, 1], 'v3.5 @0.85': [0, false, 0.85], 'v3.5 @0.75': [0, false, 0.75], 'v3.5 @0.6': [0, false, 0.6] }
  const res = Object.fromEntries(Object.keys(cfgs).map((k) => [k, []]))
  for (let r = 0; r < R; r++) for (const [k, c] of Object.entries(cfgs)) { set(...c); await measure(2); res[k].push(await measure()) }
  const buf = `${window.__gl.domElement.width}x${window.__gl.domElement.height}`
  return { res, buf, dpr: rt.dpr }
}, Number(rounds))
console.log(`viewport ${vp} @${dsf}x, canvas dpr ${out.dpr}, drawing buffer ${out.buf}, p=${ps}`)
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]
const base = med(out.res['v3.4 (msaa2, depth-resolve, 1.0)'])
for (const [k, v] of Object.entries(out.res)) console.log(`${k.padEnd(36)} median ${med(v).toFixed(0).padStart(5)} ms  (${((med(v) / base) * 100).toFixed(0)}% of v3.4)   rounds: ${v.map((x) => x.toFixed(0)).join(' ')}`)
await browser.close()
