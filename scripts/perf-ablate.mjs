// V3.5 — which part of the frame is expensive? Removes one thing at a time and measures the wall frame time
// (headless SwiftShader rasterises on the CPU: wall time is a *relative proxy* for GPU shading/fill/bandwidth cost — never device FPS).
// usage: node scripts/perf-ablate.mjs <quality> <WxH> <name:p,...> [frames]     env: PORT TOUCH DSF
import { chromium } from 'playwright-core'
const [quality = 'balanced', vp = '640x360', secs = 'opening:0,tracks:0.46,roof:0.9', frames = '10'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: process.env.TOUCH === '1', isMobile: process.env.TOUCH === '1' })).newPage()
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
console.log(`quality ${quality}  viewport ${W}x${H}  DSF ${process.env.DSF || 1}  buffer ${await page.evaluate(() => `${window.__gl.domElement.width}x${window.__gl.domElement.height}`)}`)
for (const spec of secs.split(',')) {
  const [name, ps] = spec.split(':')
  await page.evaluate((p) => window.__hd.jump(p), Number(ps))
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 300000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async (N) => {
    const scene = window.__scene, rt = window.__hd.rt
    const THREE_Mat = window.__gl && null
    const measure = async () => {
      const dts = []; let last = performance.now(), k = 0
      await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) dts.push(n - last); last = n; if (++k >= N + 2) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
      dts.sort((a, b) => a - b)
      return { avg: dts.reduce((s, v) => s + v, 0) / dts.length, med: dts[Math.floor(dts.length / 2)], calls: rt.stats.calls, tris: rt.stats.tris }
    }
    const hide = async (pred) => {
      const hidden = []
      scene.traverse((o) => { if (o.visible && pred(o)) { o.visible = false; hidden.push(o) } })
      const r = await measure(); hidden.forEach((o) => (o.visible = true)); r.n = hidden.length; return r
    }
    const res = {}
    res.full = await measure()
    res.noScene = await (async () => { scene.visible = false; const r = await measure(); scene.visible = true; return r })()
    res.basicMaterial = await (async () => { const M = window.__gl.constructor; const mat = new (Object.getPrototypeOf(scene.children[0]?.material || {}).constructor)(); return null })()
    res.noTransparent = await hide((o) => (o.isMesh || o.isPoints || o.isSprite) && o.material && !Array.isArray(o.material) && o.material.transparent)
    res.noPointsSprites = await hide((o) => o.isPoints || o.isSprite)
    res.noReflector = await hide((o) => o.name === 'PuddleReflector' || (o.isMesh && o.onBeforeRender && o.onBeforeRender.toString().includes('REFLECT')) || o.type === 'Reflector')
    res.noInstanced = await hide((o) => o.isInstancedMesh)
    res.noLights = await hide((o) => o.isLight && !o.isHemisphereLight && !o.isDirectionalLight)
    res.noEmissiveWindows = null
    return res
  }, Number(frames))
  const f = out.full.avg
  console.log(`\n== ${name} (p=${ps})  full ${f.toFixed(0)} ms  (median ${out.full.med.toFixed(0)}, calls ${out.full.calls}, tris ${(out.full.tris / 1000).toFixed(0)}k)`)
  for (const [k, v] of Object.entries(out)) { if (!v || k === 'full' || k === 'basicMaterial' || k === 'noEmissiveWindows') continue; console.log(`   ${k.padEnd(16)} ${v.avg.toFixed(0).padStart(5)} ms  Δ ${(v.avg - f).toFixed(0).padStart(5)} (${(((v.avg - f) / f) * 100).toFixed(0)}%)${v.n != null ? `  [${v.n} objects hidden]` : ''}  calls ${v.calls}`) }
}
await browser.close()
