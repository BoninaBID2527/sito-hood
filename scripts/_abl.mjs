import { chromium } from 'playwright-core'
const port = process.argv[2] || '3000'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage()
await page.goto(`http://localhost:${port}/?debug=1&quality=high`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(8000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280, null, { timeout: 300000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
await page.evaluate(() => { window.__hd.jump(0.16); window.__hd.rt.snapSpring = 0.16 })
await page.waitForTimeout(6000)
const res = await page.evaluate(async () => {
  const rt = window.__hd.rt, scene = window.__scene
  const measure = async (N = 5) => { const d = []; let last = performance.now(), k = 0; await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) d.push(n - last); last = n; if (++k >= N + 2) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }); d.sort((a, b) => a - b); return d[d.length >> 1] }
  const out = {}
  const hide = async (name, pred) => { const hs = []; scene.traverse((o) => { if (o.visible && pred(o)) { o.visible = false; hs.push(o) } }); const t = await measure(); hs.forEach((o) => (o.visible = true)); out[name] = [Math.round(t), hs.length] }
  for (let r = 0; r < 2; r++) {
    out['full' + r] = await measure()
    const q = rt.quality.shadow; rt.quality.shadow = 0; await measure(2); out['noShadow' + r] = Math.round(await measure()); rt.quality.shadow = q; await measure(2)
  }
  await hide('noWaterSheet', (o) => o.material && o.material.name === 'PuddleReflector' || (o.type === 'Mesh' && o.onBeforeRender && /reflector/i.test(o.onBeforeRender.toString().slice(0, 400))))
  await hide('noInstanced', (o) => o.isInstancedMesh)
  await hide('noGround', (o) => o.receiveShadow && o.geometry && o.geometry.attributes.position.count > 10000)
  await hide('noTransparent', (o) => (o.isMesh || o.isPoints) && o.material && !Array.isArray(o.material) && o.material.transparent)
  return out
})
console.log(JSON.stringify(res))
await browser.close()
