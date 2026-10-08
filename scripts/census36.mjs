// V3.6 — performance census over the checkpoint set: draw calls / triangles / textures / geometries / drawing buffer / render scale / relative
// headless wall time (software GL: relative only, NEVER device FPS). usage: node scripts/census36.mjs <port> <tier> <out.json> [WxH] [cps]
import { chromium } from './browser.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { runCheckpoint, CHECKPOINTS } from './qa36-lib.mjs'
const [port = '3000', tier = 'high', outFile = 'census.json', vp = '960x540', cpl = '1,10,11,13,14,23,26,27,30,32,33'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const want = new Set(cpl.split(',').map(String))
const webm = process.env.WEBM ? readFileSync(process.env.WEBM) : null
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1) })).newPage()
if (webm) await page.route('**/hooddino-studio-arrangiamento.mp4', (r) => r.fulfill({ status: 200, body: webm, headers: { 'content-type': 'video/webm', 'accept-ranges': 'none' } }))
await page.goto(`http://localhost:${port}/?debug=1&quality=${tier}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")', { force: true })
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 300000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const log = []
const until = (fn, arg, to = 120000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => {})
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) })
const rows = []
const onShot = async (cp) => {
  const r = await page.evaluate(async () => {
    const dts = []; let last = performance.now(), k = 0
    const calls = [], tris = []
    await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) { dts.push(n - last); calls.push(window.__hd.rt.stats.calls); tris.push(window.__hd.rt.stats.tris) } last = n; if (++k >= 8) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length
    const i = window.__gl.info
    return { ms: avg(dts), calls: Math.round(avg(calls)), tris: Math.round(avg(tris)), tex: i.memory.textures, geo: i.memory.geometries, buf: `${window.__gl.domElement.width}x${window.__gl.domElement.height}`, scale: window.__hd.rt.scale, world: window.__hd.rt.world }
  })
  rows.push({ n: cp.n, name: cp.name, ...r })
  console.log(`${String(cp.n).padStart(2)} ${cp.name.padEnd(26)} calls ${String(r.calls).padStart(4)}  tris ${(r.tris / 1000).toFixed(0).padStart(4)}k  tex ${r.tex}  geo ${r.geo}  buf ${r.buf} scale ${r.scale}  wall ${r.ms.toFixed(0)} ms`)
}
for (const cp of CHECKPOINTS) { if (!want.has(String(cp.n))) continue; await runCheckpoint(page, { ...cp, wait: 500 }, '.', { until, settle, log, onShot }) }
writeFileSync(outFile, JSON.stringify({ port, tier, vp, rows }, null, 1))
await browser.close()
