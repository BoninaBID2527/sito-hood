// V3.5 — frame-pacing + CPU attribution (headless software GL; RELATIVE numbers only, never device FPS).
// Per section: wall frame-time distribution (avg / p50 / p95 / p99 / worst), main-thread JS per frame split by useFrame callback and
// by renderer.render submission, JS allocation rate, React commits per second, draw calls / triangles.
// Run against `next dev` for readable callback names (the production build minifies them).
// usage: node scripts/perf-frame.mjs <quality> <WxH> <name:p,name:p,...> [frames]     env: PORT=3000 TOUCH=1 DSF=1
import { chromium } from 'playwright-core'
const [quality = 'balanced', vp = '640x360', secs = 'opening:0,mid:0.16,tracks:0.46,roof:0.9', frames = '40'] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-precise-memory-info'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: touch, isMobile: touch })
const page = await ctx.newPage()
await page.addInitScript(() => {
  window.__commits = { dom: 0, r3f: 0 }
  const ids = []
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), isDisabled: false,
    inject(r) { const id = ids.length + 1; ids.push(r.rendererPackageName || r.rendererConfig?.rendererPackageName || 'x'); this.renderers.set(id, r); return id },
    onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(id) { const n = ids[id - 1] || ''; if (/dom/i.test(n)) window.__commits.dom++; else window.__commits.r3f++ },
    checkDCE() {},
  }
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 240000, polling: 500 }).catch(() => {})
await page.addStyleTag({ content: '.overlay{display:none !important}' })
console.log(`quality ${quality}  viewport ${W}x${H}  DSF ${process.env.DSF || 1}  tier now ${await page.evaluate(() => window.__hd.rt.quality.tier)}  buffer ${await page.evaluate(() => `${window.__gl.domElement.width}x${window.__gl.domElement.height}`)}`)
for (const spec of secs.split(',')) {
  const [name, ps] = spec.split(':')
  const p = Number(ps)
  await page.evaluate((p) => window.__hd.jump(p), p)
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 }, null, { timeout: 300000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const r = await page.evaluate(async (N) => {
    const st = window.__r3f, subs = st.internal.subscribers, gl = window.__gl, rt = window.__hd.rt
    const acc = subs.map(() => ({ t: 0, n: 0 }))
    const names = subs.map((s, i) => `${i}:p${s.priority}:` + String(s.ref.current).replace(/\s+/g, ' ').slice(0, 80))
    const orig = subs.map((s) => s.ref.current)
    subs.forEach((s, i) => { s.ref.current = function (...a) { const t = performance.now(); const o = orig[i].apply(this, a); acc[i].t += performance.now() - t; acc[i].n++; return o } })
    const rOrig = gl.render
    let renderT = 0, renderN = 0
    gl.render = function (...a) { const t = performance.now(); const o = rOrig.apply(this, a); renderT += performance.now() - t; renderN++; return o }
    const c0 = { ...window.__commits }
    const heap = []
    const dts = []
    let last = performance.now(), calls = 0, tris = 0, k = 0
    await new Promise((res) => {
      const f = () => {
        const now = performance.now(); dts.push(now - last); last = now
        heap.push(performance.memory ? performance.memory.usedJSHeapSize : 0)
        calls += rt.stats.calls; tris += rt.stats.tris
        if (++k >= N + 2) res(); else requestAnimationFrame(f)
      }
      requestAnimationFrame(f)
    })
    subs.forEach((s, i) => { s.ref.current = orig[i] })
    gl.render = rOrig
    const d = dts.slice(2).sort((a, b) => a - b)
    const pick = (q) => d[Math.min(d.length - 1, Math.floor(q * d.length))]
    let alloc = 0
    for (let i = 3; i < heap.length; i++) alloc += Math.max(0, heap[i] - heap[i - 1])
    const frames = d.length
    const rows = acc.map((a, i) => ({ n: names[i], ms: a.t / Math.max(1, frames) })).sort((a, b) => b.ms - a.ms).slice(0, 12)
    const jsTotal = acc.reduce((s, a) => s + a.t, 0) / frames
    return {
      frames, avg: d.reduce((s, v) => s + v, 0) / frames, p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), worst: d[d.length - 1],
      js: jsTotal, renderSubmit: renderT / Math.max(1, frames), allocKBperFrame: alloc / 1024 / frames,
      commitsDom: (window.__commits.dom - c0.dom) / (frames * d.reduce((s, v) => s + v, 0) / frames / 1000), commitsR3f: (window.__commits.r3f - c0.r3f),
      calls: Math.round(calls / (frames + 2)), tris: Math.round(tris / (frames + 2) / 1000), world: rt.world, scale: rt.scale ?? 1, dpr: rt.dpr, tier: rt.quality.tier, rows,
    }
  }, Number(frames))
  console.log(`\n== ${name} (p=${p}, world ${r.world})  wall ms/frame: avg ${r.avg.toFixed(0)} p50 ${r.p50.toFixed(0)} p95 ${r.p95.toFixed(0)} p99 ${r.p99.toFixed(0)} worst ${r.worst.toFixed(0)}  | main-thread JS ${r.js.toFixed(1)} ms/frame (useFrame callbacks; render() submit incl. ${r.renderSubmit.toFixed(1)})  alloc ${r.allocKBperFrame.toFixed(0)} KB/frame  React commits: dom ${r.commitsDom.toFixed(1)}/s r3f ${r.commitsR3f} in window  calls ${r.calls} tris ${r.tris}k  dpr ${r.dpr} scale ${r.scale}`)
  for (const x of r.rows) console.log(`   ${x.ms.toFixed(2).padStart(6)} ms  ${x.n}`)
}
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors')
await browser.close()
