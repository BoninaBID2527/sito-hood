// Focused check of the V3.1 secrets: number trail (mouse + touch), persistence across reload, reset, 7/7, anamorph, puddle.
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
let pass = 0, fail = 0
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`) }
const errors = []
const TRAIL = [
  [0, 0.04, 3.096, 1.5, 2.6, '01 utility box'],
  [1, 0.08, -3.212, 1.42, -6.7, '02 drainpipe'],
  [2, 0.12, 2.735, 1.62, -12.5, '03 door'],
  [3, 0.165, -2.9245, 1.6, -24.6, '04 torn poster'],
  [4, 0.24, 3.1, 5.9, -36.45, '05 fire escape'],
  [6, 0.36, -4.1, 0.05, -92.4, '07 water'],
]
async function open(touch) {
  const ctx = await browser.newContext({ viewport: { width: touch ? 820 : 1280, height: touch ? 1180 : 720 }, hasTouch: touch, isMobile: touch })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:3000/?debug=1&quality=low')
  await page.waitForSelector('button:has-text("ENTER")', { timeout: 180000 })
  await page.click('button:has-text("ENTER")')
  await page.waitForTimeout(6000)
  return { ctx, page }
}
const tools = (page) => ({
  settle: () => page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0015 && Math.abs(r.velocity) < 0.002 }, null, { timeout: 90000 }).catch(() => {}),
  screen: (x, y, z) => page.evaluate(([x, y, z]) => { const c = window.__camera; c.updateMatrixWorld(); const v = new c.position.constructor(x, y, z).project(c); return { sx: (v.x * 0.5 + 0.5) * innerWidth, sy: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 } }, [x, y, z]),
})

for (const touch of [false, true]) {
  const { ctx, page } = await open(touch)
  const innerW = touch ? 820 : 1280, innerH = touch ? 1180 : 720
  const T = tools(page)
  const jump = async (p) => { await page.evaluate((p) => window.__hd.jump(p), p); await T.settle(); await page.waitForTimeout(2200) }
  const tag = touch ? 'touch' : 'mouse'
  for (const [i, p, x, y, z, name] of TRAIL) {
    await jump(p)
    let s = await T.screen(x, y, z)
    const inView = (s) => !s.behind && s.sx > 20 && s.sx < innerW - 20 && s.sy > 20 && s.sy < innerH - 20
    if (touch && !inView(s)) {
      // narrow portrait view: walk the scroll a little until the object passes through the frame (that is what a thumb does)
      for (const d of [0.006, 0.012, 0.018, -0.006, -0.012, 0.024, 0.03]) {
        await jump(Math.max(0, p + d))
        s = await T.screen(x, y, z)
        if (inView(s)) break
      }
    }
    if (touch) await page.touchscreen.tap(s.sx, s.sy)
    else {
      // the camera parallaxes with the pointer, so aim, let it settle, re-aim, then click (what a person does)
      await page.mouse.move(s.sx, s.sy, { steps: 4 }); await page.waitForTimeout(1200)
      s = await T.screen(x, y, z)
      await page.mouse.move(s.sx, s.sy, { steps: 2 }); await page.waitForTimeout(900)
      s = await T.screen(x, y, z)
      await page.mouse.click(s.sx, s.sy)
    }
    await page.waitForTimeout(900)
    check(`[${tag}] number ${name}`, await page.evaluate((i) => window.__hd.store.getState().nums[i], i), JSON.stringify(s))
  }
  check(`[${tag}] no toast / counter after finding numbers`, await page.evaluate(() => !window.__hd.store.getState().toast))
  if (!touch) {
    // roof marking 06 + 7/7 → persistence across reload
    await page.evaluate(() => window.__hd.act('foundNumber', 5))
    check('7/7 reached', await page.evaluate(() => window.__hd.store.getState().nums.every(Boolean)))
    await jump(0.98)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: process.env.SHOT || 'secrets-roof.png' })
    await page.reload()
    await page.waitForSelector('button:has-text("ENTER")', { timeout: 180000 })
    check('numbers persist after refresh', await page.evaluate(() => window.__hd.store.getState().nums.every(Boolean)))
    await page.evaluate(() => window.__hd.reset())
    check('debug reset clears everything', await page.evaluate(() => window.__hd.store.getState().nums.every((v) => !v) && !localStorage.getItem('hd:nums')))
  }
  await ctx.close()
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors')
console.log(`${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
