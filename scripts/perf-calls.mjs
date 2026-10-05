// V3.5 — which materials/geometries account for the draw calls in view? (frustum + hierarchy visibility; instanced meshes count once)
// usage: node scripts/perf-calls.mjs <quality> <p1,p2,..>
import { chromium } from 'playwright-core'
const [quality = 'balanced', pl = '0.16,0.3'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage()
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(8000)
for (const p of pl.split(',').map(Number)) {
  await page.evaluate((p) => window.__hd.jump(p), p)
  await page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.001 }, null, { timeout: 300000 }).catch(() => {})
  await page.waitForTimeout(3000)
  const out = await page.evaluate(() => {
    const scene = window.__scene, cam = window.__camera
    const THREE = window.__gl.constructor && null
    const vis = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true }
    const fr = new (cam.projectionMatrix.constructor)()
    const frustumTest = (() => { const m = fr.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); const pl = []; const e = m.elements
      const P = (a, b, c, d) => { const l = Math.hypot(a, b, c); pl.push([a / l, b / l, c / l, d / l]) }
      P(e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]); P(e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12])
      P(e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]); P(e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13])
      P(e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]); P(e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14])
      return (o) => { if (o.frustumCulled === false) return true; const g = o.geometry; if (!g) return true; if (!g.boundingSphere) g.computeBoundingSphere(); const c = g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld); const s = o.matrixWorld.getMaxScaleOnAxis() * g.boundingSphere.radius
        return pl.every((q) => q[0] * c.x + q[1] * c.y + q[2] * c.z + q[3] >= -s) } })()
    cam.updateMatrixWorld()
    const rows = new Map(); let total = 0
    scene.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !vis(o) || !frustumTest(o)) return
      if (o.layers && !(o.layers.mask & cam.layers.mask)) return
      const m = Array.isArray(o.material) ? o.material : [o.material]
      total += m.length
      for (const mm of m) {
        const k = mm.uuid
        if (!rows.has(k)) rows.set(k, { n: 0, mat: `${mm.type}${mm.name ? ':' + mm.name : ''}${mm.transparent ? ' T' : ''}`, geo: o.geometry?.type, tris: 0, inst: !!o.isInstancedMesh, pos: o.getWorldPosition(new o.position.constructor()).toArray().map((v) => v.toFixed(0)).join(',') })
        const r = rows.get(k); r.n++; const g = o.geometry; r.tris += ((g?.index ? g.index.count : g?.attributes?.position?.count || 0) / 3) * (o.isInstancedMesh ? o.count : 1)
      }
    })
    return { total, rows: [...rows.values()].sort((a, b) => b.n - a.n).slice(0, 16) }
  })
  console.log(`\n== ${quality} p=${p}: ${out.total} draw objects in view (renderer says ${await page.evaluate(() => window.__hd.rt.stats.calls)} incl. reflection pass)`)
  for (const r of out.rows) console.log(`${String(r.n).padStart(4)}x  ${r.mat.padEnd(34)} ${String(r.geo).padEnd(18)} ${(r.tris / 1000).toFixed(1).padStart(6)}k tris ${r.inst ? 'instanced' : ''} @${r.pos}`)
}
await browser.close()
