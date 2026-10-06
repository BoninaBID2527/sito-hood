// temporary debug helper: for checkpoint 3, hide each shader/transparent object in turn and count near-white pixels in the speckle region
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { runCheckpoint, CHECKPOINTS } from './qa36-lib.mjs'
const out = process.argv[2]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await page.goto(`http://localhost:3000/?debug=1&quality=high`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
const until = (fn, arg, to = 120000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).catch(() => {})
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 })
const cp = CHECKPOINTS.find((c) => c.n === 3)
await runCheckpoint(page, { ...cp, name: 'sp-base' }, out, { until, settle, log: [] })
const settleFrames = () => page.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k > 8 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }))
await page.evaluate((c) => { window.__hd.rt.camOverride = c }, cp.cam)
await settleFrames()
await page.screenshot({ path: out + '/v0.png' })
const setOut = async (name, expr) => {
  const ok = await page.evaluate((expr) => { let n = 0; window.__scene.traverse((o) => { const m = o.material; if (m && m.uniforms && m.uniforms.tMask) { if (!m.userData.f0) m.userData.f0 = m.fragmentShader; m.fragmentShader = m.userData.f0.replace('gl_FragColor = vec4(c, a);', expr); m.needsUpdate = true; n++ } }); return n }, expr)
  await settleFrames(); await settleFrames()
  await page.screenshot({ path: out + '/' + name + '.png' })
  console.log(name, ok)
}
await setOut('alpha', 'gl_FragColor = vec4(vec3(a), 1.0);')
await setOut('mask', 'gl_FragColor = vec4(vec3(m), 1.0);')
await setOut('damp', 'gl_FragColor = vec4(vec3(damp), 1.0);')
await setOut('color', 'gl_FragColor = vec4(c, 1.0);')
await browser.close()
