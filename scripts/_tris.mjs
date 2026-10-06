import { chromium } from 'playwright-core'
const port = process.argv[2] || '3000'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage()
await page.goto(`http://localhost:${port}/?debug=1&quality=high`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")')
await page.waitForTimeout(12000)
const out = await page.evaluate(() => {
  const vis = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true }
  const rows = []
  window.__scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints) || !vis(o)) return
    const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1)
    g.computeBoundingBox(); const bb = g.boundingBox; rows.push({ n: Math.round(n), box: [bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z].map((v)=>v.toFixed(1)).join('x'), col: o.material?.color?.getHexString?.(), mat: o.material?.type, shadow: o.castShadow ? 'C' : '', recv: o.receiveShadow ? 'R' : '', name: o.name || g.type, verts: g.attributes.position.count })
  })
  rows.sort((a, b) => b.n - a.n)
  return { total: rows.reduce((s, r) => s + r.n, 0), top: rows.slice(0, 14), stats: window.__hd.rt.stats }
})
console.log(JSON.stringify(out.stats), 'total tris in scene', out.total)
for (const r of out.top) console.log(String(r.n).padStart(8), r.box, r.col, r.mat, r.name, r.shadow, r.recv, 'verts', r.verts)
await browser.close()
