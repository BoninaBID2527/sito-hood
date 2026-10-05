import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage()
await page.goto('http://localhost:3000/?debug=1&quality=balanced')
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(8000)
await page.addStyleTag({ content: '.overlay{display:none !important}' })
for (const p of [0.16, 0.3]) {
  await page.evaluate((p) => window.__hd.jump(p), p)
  await page.waitForTimeout(6000)
  const r = await page.evaluate(async () => {
    let sky; window.__scene.traverse((o) => { if (o.geometry?.parameters?.radius === 400) sky = o })
    const measure = async (N = 6) => { const d = []; let last = performance.now(), k = 0; await new Promise((res) => { const f = () => { const n = performance.now(); if (k > 1) d.push(n - last); last = n; if (++k >= N + 2) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }); return d.reduce((a, b) => a + b, 0) / d.length }
    const out = { new: [], old: [], none: [] }
    for (let i = 0; i < 3; i++) {
      sky.material.depthTest = true; sky.renderOrder = 1000; out.new.push(await measure())
      sky.material.depthTest = false; sky.renderOrder = -100; out.old.push(await measure())
      sky.visible = false; out.none.push(await measure()); sky.visible = true
    }
    sky.material.depthTest = true; sky.renderOrder = 1000
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.map((x) => x.toFixed(0)).join(' ')]))
  })
  console.log(`p=${p}`, JSON.stringify(r))
}
await browser.close()
