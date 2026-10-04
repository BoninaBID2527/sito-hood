// Street draw-call / initial-load comparison helper. usage: node scripts/street-calls.mjs <port> <quality> <p1,p2,...>
import { chromium } from 'playwright-core'
const [port = '3000', quality = 'high', plist = '0.327'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
let bytes = 0, reqs = 0, js = 0
const seen = []
page.on('response', async (r) => { try { const b = (await r.body()).length; bytes += b; reqs++; if (/\.js(\?|$)/.test(r.url())) js += b; seen.push([r.url().replace(/^https?:\/\/[^/]+/, ''), b]) } catch {} })
await page.goto(`http://localhost:${port}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
await page.waitForTimeout(2000)
console.log(`initial load (until ENTER screen): ${reqs} requests, ${(bytes / 1024).toFixed(0)} KB total, ${(js / 1024).toFixed(0)} KB JS; room assets: ${seen.filter(([u]) => /\/room\//.test(u)).length}`)
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
await page.addStyleTag({ content: '.overlay{display:none !important}' })
for (const p of plist.split(',').map(Number)) {
  await page.evaluate((p) => window.__hd.jump(p), p)
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.001 }, null, { timeout: 300000 })
  await page.waitForTimeout(2500)
  const r = await page.evaluate(async () => {
    const rt = window.__hd.rt; const calls = []; let last = rt.time
    await new Promise((res) => { const f = () => { if (rt.time !== last) { last = rt.time; calls.push([rt.stats.calls - (rt.stats.refl || 0), rt.stats.refl || 0, rt.stats.tris]) } calls.length >= 24 ? res() : requestAnimationFrame(f) }; requestAnimationFrame(f) })
    const a = (i) => Math.round(calls.reduce((s, c) => s + c[i], 0) / calls.length)
    return { main: a(0), refl: a(1), tris: a(2), tex: window.__gl.info.memory.textures, geo: window.__gl.info.memory.geometries }
  })
  console.log(`p=${p}: main ${r.main} + refl ${r.refl}  tris ${(r.tris / 1000).toFixed(1)}k  tex ${r.tex} geo ${r.geo}`)
}
await browser.close()
