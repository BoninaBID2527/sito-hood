// Rendering census per journey section: draw calls / triangles averaged over many real frames (a reflection refresh frame costs
// ~2× a normal one, so single-frame readings are misleading). Headless software GL: COUNTS ONLY — never FPS.
// usage: node scripts/census.mjs <quality> [url]
import { chromium } from 'playwright-core'
const quality = process.argv[2] || 'high'
const url = process.argv[3] || process.env.URL || 'http://localhost:3000/'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${url}?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const P = (i) => (process.env.BASE === '1' ? 0.36 + (i / 6) * 0.24 : 0.41 + (i / 6) * 0.185)
const settle = () => page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) }, null, { timeout: 240000 }).catch(() => {})
const sample = (n = 24) => page.evaluate(async (n) => {
  const rt = window.__hd.rt, g = window.__gl
  const out = { calls: [], tris: [] }
  let last = rt.time
  await new Promise((res) => { const f = () => { if (rt.time !== last) { last = rt.time; out.calls.push(rt.stats.calls); out.tris.push(rt.stats.tris) } if (out.calls.length >= n) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
  const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / a.length)
  const f = rt.fx
  const post = ['rgb', 'liquid', 'tunnel', 'glitch', 'focusDim', 'dualism'].filter((k) => Math.abs(f[k] || 0) > 0.02)
  return { avg: avg(out.calls), min: Math.min(...out.calls), max: Math.max(...out.calls), tris: avg(out.tris), tex: g.info.memory.textures, geo: g.info.memory.geometries, prog: g.info.programs?.length, dpr: rt.dpr, tier: rt.quality.tier, post, world: rt.world, reflectEvery: rt.quality.reflectEvery, reflRes: rt.quality.reflector ? rt.quality.reflectorRes : 0, msaa: rt.quality.msaa, buf: [g.domElement.width, g.domElement.height] }
}, n)
const rows = []
const run = async (name, fn) => { await fn(); const r = await sample(); rows.push([name, r]); console.log(`${name.padEnd(26)} calls avg ${String(r.avg).padStart(3)} (min ${r.min}, max ${r.max})  tris ${(r.tris / 1000).toFixed(0)}k  tex ${r.tex} geo ${r.geo}  dpr ${r.dpr}  buf ${r.buf.join('×')}  tier ${r.tier}  post[${r.post.join(',')}]`) }
await run('A opening alley', async () => { await page.evaluate(() => window.__hd.jump(0.0)); await settle(); await page.waitForTimeout(2000) })
await run('B mid alley', async () => { await page.evaluate(() => window.__hd.jump(0.2)); await settle(); await page.waitForTimeout(2000) })
await run('C tracks idle (04)', async () => { await page.evaluate((p) => window.__hd.jump(p), P(3)); await settle(); await page.waitForTimeout(2500) })
await run('D tracks transition', async () => {
  await page.evaluate((p) => window.__hd.jump(p), P(2)); await settle()
  await page.evaluate((p) => window.__hd.jump(p), P(4)); await page.waitForTimeout(1200)
})
await run('E track focused (04)', async () => { await page.evaluate((p) => window.__hd.jump(p), P(3)); await settle(); await page.evaluate(() => window.__hd.act('selectTrack', 3)); await page.waitForTimeout(6000) })
await page.evaluate(() => window.__hd.act('selectTrack', null))
await page.waitForTimeout(1500)
await run('F rooftop', async () => { await page.evaluate(() => window.__hd.jump(0.9)); await settle(); await page.waitForTimeout(3000) })
await run('G DUALISMO', async () => {
  await page.evaluate(() => window.__hd.jump(0.3)); await settle()
  await page.evaluate(() => window.__hd.act('enterDualism'))
  await page.waitForFunction(() => window.__hd.rt.world === 'dualism' && window.__hd.rt.dual.t > 0.95, null, { timeout: 240000 }).catch(() => {})
  await page.waitForTimeout(2500)
})
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
console.log('JSON ' + JSON.stringify(rows.map(([n, r]) => [n, r.avg, r.min, r.max, Math.round(r.tris / 1000), r.tex, r.dpr, r.buf.join('x')])))
await browser.close()
