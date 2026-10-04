// Draw-call attribution: hides each scene subtree in turn and measures the delta of the (main + reflection) pass.
// usage: node scripts/profile.mjs <quality> p1,p2,...   (headless software GL: counts only, never FPS)
import { chromium } from 'playwright-core'
const [quality = 'high', plist = '0,0.2,0.4,0.5'] = process.argv.slice(2)
const url = process.env.URL || 'http://localhost:3000/'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage()
await page.goto(`${url}?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 240000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(5000)
await page.addStyleTag({ content: '.overlay{display:none}' })
for (const p of plist.split(',').map(Number)) {
  await page.evaluate((p) => window.__hd.jump(p), p)
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const rt = window.__hd.rt, scene = window.__scene
    const frames = (n) => new Promise((res) => { const t0 = rt.time; let k = 0; const f = () => { if (rt.time !== t0 + 0 && ++k >= n) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
    // the reflection pass is throttled, so one frame is either 'main' or 'main + reflection': sample several and keep both
    const read = async () => { let mn = 1e9, mx = 0; for (let k = 0; k < 7; k++) { await frames(1); mn = Math.min(mn, rt.stats.calls); mx = Math.max(mx, rt.stats.calls) } return { calls: mx, main: mn } }
    const base = await read(); base.tris = 0
    const live = (o) => { let n = 0, tri = 0; o.traverse((c) => { if (c.isMesh || c.isPoints || c.isLine || c.isSprite) { let v = true, a = c; while (a) { if (!a.visible) { v = false; break } a = a.parent } if (v) n++ } }); return n }
    const cands = []
    const walk = (o, path, depth) => {
      o.children.forEach((c, i) => {
        const n = live(c)
        if (!c.visible || n === 0) return
        const p = `${path}/${i}`
        cands.push({ o: c, path: p, n, kind: c.type + (c.geometry ? ':' + c.geometry.type : ''), depth })
        if (depth < 2 && c.children.length > 0) walk(c, p, depth + 1)
      })
    }
    walk(scene, '', 0)
    const res = []
    for (const c of cands) {
      if (c.n < 3) continue
      c.o.visible = false
      const r = await read()
      c.o.visible = true
      res.push({ path: c.path, kind: c.kind, objs: c.n, dCalls: base.calls - r.calls, dMain: base.main - r.main })
    }
    res.sort((a, b) => b.dCalls - a.dCalls)
    const g = window.__gl
    return { base, tex: g.info.memory.textures, geo: g.info.memory.geometries, prog: g.info.programs?.length, world: rt.world, top: res.slice(0, 26) }
  })
  console.log(`\n== p=${p} world=${out.world} main-only=${out.base.main} main+reflection=${out.base.calls} textures=${out.tex} geometries=${out.geo}`)
  for (const r of out.top) console.log(`  main ${String(r.dMain).padStart(3)}  +reflection ${String(r.dCalls - r.dMain).padStart(3)}   ${r.path.padEnd(14)} ${r.kind} (${r.objs} objs)`)
}
await browser.close()
