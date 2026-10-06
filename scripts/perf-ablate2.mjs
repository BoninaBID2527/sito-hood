// V3.5 — per-system GPU-proxy ablation (headless SwiftShader: relative cost only, never device FPS).
// Ranks every *actually visible* transparent mesh group (by material) and the post-processing parts by the frame time they add.
// usage: node scripts/perf-ablate2.mjs <quality> <WxH> <p> [frames]
import { chromium } from 'playwright-core'
const [quality = 'balanced', vp = '640x360', ps = '0', frames = '8'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1) })).newPage()
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
await page.evaluate((p) => window.__hd.jump(p), Number(ps))
await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 300000 }).catch(() => {})
await page.waitForTimeout(2500)
const out = await page.evaluate(async (N) => {
  const scene = window.__scene, rt = window.__hd.rt, post = window.__post
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
  const measure = async () => {
    const dts = []; let last = performance.now(), k = 0
    await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) dts.push(n - last); last = n; if (++k >= N + 2) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
    return dts.reduce((s, v) => s + v, 0) / dts.length
  }
  const path = (o) => { const a = []; for (let p = o; p && a.length < 3; p = p.parent) a.push(p.name || p.type); return a.join('<') }
  const base = await measure()
  const groups = new Map()
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isSprite) || !vis(o)) return
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    if (!m || !m.transparent) return
    const key = m.uuid
    if (!groups.has(key)) groups.set(key, { objs: [], mat: m.type + (m.name ? ':' + m.name : ''), where: path(o), tris: 0 })
    const g = groups.get(key); g.objs.push(o); g.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1)
  })
  const rows = []
  for (const g of groups.values()) {
    g.objs.forEach((o) => (o.visible = false))
    const t = await measure()
    g.objs.forEach((o) => (o.visible = true))
    rows.push({ what: `transparent ${g.mat} @${g.where} x${g.objs.length} (${(g.tris / 1000).toFixed(1)}k tris)`, d: t - base })
  }
  rows.sort((a, b) => a.d - b.d)
  // opaque meshes grouped by top-level named ancestor
  const og = new Map()
  scene.traverse((o) => {
    if (!o.isMesh || !vis(o)) return
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    if (!m || m.transparent) return
    const key = m.type + ':' + (m.name || m.uuid.slice(0, 6))
    if (!og.has(key)) og.set(key, { objs: [], where: path(o) })
    og.get(key).objs.push(o)
  })
  const orows = []
  for (const [k, g] of og) { if (g.objs.length < 1) continue; g.objs.forEach((o) => (o.visible = false)); const t = await measure(); g.objs.forEach((o) => (o.visible = true)); orows.push({ what: `opaque ${k} @${g.where} x${g.objs.length}`, d: t - base }) }
  orows.sort((a, b) => a.d - b.d)
  // post parts
  const prow = []
  const tgt = post.target
  const m0 = tgt.texture.generateMipmaps; tgt.texture.generateMipmaps = false; prow.push({ what: 'post: no per-frame mip generation (bloom reads mip 0)', d: (await measure()) - base }); tgt.texture.generateMipmaps = m0
  const q0 = rt.quality; rt.quality = { ...q0, bloom: 0 }; prow.push({ what: 'post: bloom off', d: (await measure()) - base }); rt.quality = q0
  const s0 = tgt.samples; tgt.samples = 0; tgt.dispose(); prow.push({ what: 'post: MSAA off', d: (await measure()) - base }); tgt.samples = s0; tgt.dispose()
  await measure()
  return { base, rows, orows, prow, buf: `${window.__gl.domElement.width}x${window.__gl.domElement.height}`, calls: rt.stats.calls, tris: rt.stats.tris }
}, Number(frames))
console.log(`${quality} ${vp} p=${ps} buffer ${out.buf} base ${out.base.toFixed(0)} ms  calls ${out.calls} tris ${(out.tris / 1000).toFixed(0)}k`)
for (const r of [...out.prow, ...out.rows.slice(0, 14), ...out.orows.slice(0, 10)]) console.log(`${r.d.toFixed(0).padStart(6)} ms (${((r.d / out.base) * 100).toFixed(0).padStart(4)}%)  ${r.what}`)
await browser.close()
