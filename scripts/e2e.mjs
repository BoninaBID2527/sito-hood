// End-to-end behaviour test (software GL). usage: node scripts/e2e.mjs [outDir] [WxH]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] || 'shots-e2e'
const [w, h] = (process.argv[3] || '1280x720').split('x').map(Number)
const touch = process.env.TOUCH === '1'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
const page = await ctx.newPage()
await page.addInitScript(() => { window.__ac = 0; const AC = window.AudioContext; if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac++ } } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/THREE\.Clock|metadataBase/.test(m.text()))) errors.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))

let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`) }
const settle = (t = 90000) => page.waitForFunction(() => { const r = window.__hd?.rt; return r && Math.abs(r.smooth - r.progress) < 0.0015 && Math.abs(r.velocity) < 0.002 && (r.world !== 'alley' || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.1)) }, null, { timeout: t }).catch(() => console.log('  (settle timeout)'))
const jump = async (p) => { await page.evaluate((p) => window.__hd.jump(p), p); await settle() }
const st = (fn) => page.evaluate(fn)

await page.goto('http://localhost:3000/?debug=1&quality=low', { waitUntil: 'load' })
await page.waitForSelector('button:has-text("ENTER ALTERCO")', { timeout: 120000 })
check('loader reaches 100% and shows ENTER', true)
const webgl = await page.evaluate(() => !!document.querySelector('canvas'))
check('WebGL canvas mounted', webgl)
check('no AudioContext exists before the user clicks ENTER', (await st(() => window.__ac)) === 0)
await page.click('button:has-text("ENTER ALTERCO")')
await page.waitForTimeout(6000)
check('audio engine starts only after the explicit ENTER click', (await st(() => window.__ac)) === 1)
check('phase = entered', await st(() => window.__hd.store.getState().phase === 'entered'))


// ── pointer parallax moves the camera
const cam0 = await st(() => window.__camera.position.x)
await page.mouse.move(w * 0.9, h * 0.5)
await page.waitForTimeout(6000)
const cam1 = await st(() => window.__camera.position.x)
check('pointer parallax shifts camera in X (real parallax)', Math.abs(cam1 - cam0) > 0.02, `Δx=${(cam1 - cam0).toFixed(3)}`)

// ── scroll drives the camera along the spline
await jump(0.2)
const z20 = await st(() => window.__camera.position.z)
await jump(0.3)
const z30 = await st(() => window.__camera.position.z)
check('scroll moves camera forward along −Z', z30 < z20 - 5, `z(0.2)=${z20.toFixed(1)} z(0.3)=${z30.toFixed(1)}`)

// ── orbit + hover + select
await jump(0.46)
await page.screenshot({ path: `${out}/orbit.png` })
const front = await st(() => window.__hd.store.getState().front)
check('orbit exposes a front track', front >= 0 && front < 7, `front=${front}`)
// find the front card on screen by sweeping the pointer until the cursor kind becomes "track"
let hit = null
for (const fx of [0.5, 0.55, 0.45, 0.6, 0.4, 0.65, 0.35]) {
  for (const fy of [0.6, 0.55, 0.65, 0.5, 0.7]) {
    await page.mouse.move(w * fx, h * fy)
    await page.waitForTimeout(450)
    const k = await st(() => window.__hd.store.getState().cursor.kind)
    if (k === 'track') { hit = [fx, fy]; break }
  }
  if (hit) break
}
check('hovering a card sets the TRACK cursor', !!hit, hit ? `at ${hit}` : '')
if (hit) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/hover.png` })
  await page.mouse.click(w * hit[0], h * hit[1])
  await page.waitForTimeout(2500)
  // a tap on a neighbour first travels the camera to it; the second tap on the track in front opens it
  if ((await st(() => window.__hd.store.getState().selected)) === null) {
    await page.waitForTimeout(3500)
    for (const [fx, fy] of [[hit[0], hit[1]], [0.5, 0.55], [0.5, 0.6], [0.5, 0.5]]) {
      await page.mouse.move(w * fx, h * fy)
      await page.waitForTimeout(500)
      if ((await st(() => window.__hd.store.getState().cursor.label)) === 'OPEN') { await page.mouse.click(w * fx, h * fy); break }
    }
    await page.waitForTimeout(2500)
  }
  const sel = await st(() => window.__hd.store.getState().selected)
  check('clicking a card selects the track', sel !== null, `selected=${sel}`)
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${out}/focus.png` })
  const dim = await st(() => window.__hd.rt.fx.focusDim)
  check('background darkens while focused', dim > 0.05, `focusDim=${dim.toFixed(2)}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(2500)
  check('Escape closes focus', (await st(() => window.__hd.store.getState().selected)) === null)
}

// ── touch / pointer drag rotates the orbit (swipe)
const d0 = await st(() => window.__hd.rt.orbit.drag)
await st(() => {
  const c = document.querySelector('canvas')
  const mk = (t, x) => new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: 400, bubbles: true, isPrimary: true })
  c.dispatchEvent(mk('pointerdown', 300))
  for (let i = 1; i <= 8; i++) window.dispatchEvent(mk('pointermove', 300 + i * 40))
  window.dispatchEvent(mk('pointerup', 620))
})
await page.waitForTimeout(2500)
const d1 = await st(() => window.__hd.rt.orbit.drag)
check('horizontal swipe/drag adds orbit momentum', Math.abs(d1 - d0) > 0.3, `Δdrag=${(d1 - d0).toFixed(2)}`)
const stats = await st(() => { const i = window.__gl.info.render; return { calls: i.calls, tris: i.triangles } })
console.log('orbit-zone frame stats (last pass)', stats)

// ── lamp egg (act hook) + letters
await st(() => window.__hd.store.getState().set({ lamp: false }))
await page.waitForTimeout(500)
check('lamp toggles off', (await st(() => window.__hd.store.getState().lamp)) === false)
await st(() => { for (let i = 0; i < 7; i++) window.__hd.act('foundLetter', i) })
check('all 7 hidden letters found → ALTERCO', await st(() => window.__hd.store.getState().letters.every(Boolean)))

// ── liquid pass-through → rooftop
await jump(0.69)
await page.screenshot({ path: `${out}/dive.png` })
await jump(0.8)
check('rooftop world active after the liquid cut', (await st(() => window.__hd.rt.world)) === 'roof')
await page.screenshot({ path: `${out}/roof.png` })
await jump(1)
await page.waitForTimeout(3000)
await page.screenshot({ path: `${out}/final.png` })
check('final CTA present', await page.locator('.final').count() > 0)

// ── dualismo
await st(() => window.__hd.act('enterDualism'))
await page.waitForFunction(() => window.__hd.rt.world === 'dualism' && window.__hd.rt.dual.t > 0.9, null, { timeout: 120000 }).catch(() => {})
check('DUALISMO world entered', (await st(() => window.__hd.rt.world)) === 'dualism')
await page.waitForTimeout(3000)
await page.screenshot({ path: `${out}/dualismo.png` })
await st(() => window.__hd.act('exitDualism'))
await page.waitForFunction(() => window.__hd.store.getState().mode === 'alterco' && window.__hd.rt.fx.tunnel < 0.05, null, { timeout: 120000 }).catch(() => {})
check('return to ALTERCO works', (await st(() => window.__hd.store.getState().mode)) === 'alterco')

// ── leak check: re-enter / leave the secret world a few times — GPU memory must not grow
const m0 = await st(() => ({ g: window.__gl.info.memory.geometries, t: window.__gl.info.memory.textures }))
for (let i = 0; i < 2; i++) {
  await st(() => window.__hd.act('enterDualism'))
  await page.waitForFunction(() => window.__hd.rt.world === 'dualism' && window.__hd.rt.dual.t > 0.9, null, { timeout: 120000 }).catch(() => {})
  await st(() => window.__hd.act('exitDualism'))
  await page.waitForFunction(() => window.__hd.store.getState().mode === 'alterco' && window.__hd.rt.fx.tunnel < 0.05, null, { timeout: 120000 }).catch(() => {})
}
const m1 = await st(() => ({ g: window.__gl.info.memory.geometries, t: window.__gl.info.memory.textures }))
check('no GPU geometry/texture growth across world switches', m1.g <= m0.g + 2 && m1.t <= m0.t + 2, `${JSON.stringify(m0)} → ${JSON.stringify(m1)}`)

// ── resize doesn't break
await page.setViewportSize({ width: 800, height: 900 })
await page.waitForTimeout(3000)
check('resize keeps canvas filling viewport', await st(() => { const c = document.querySelector('canvas'); return c && Math.abs(c.clientWidth - innerWidth) < 2 }))

// ── GPU resource sanity
const info = await st(() => { const g = window.__gl; return { geometries: g.info.memory.geometries, textures: g.info.memory.textures, programs: g.info.programs.length } })
console.log('renderer.info', info)
check('GPU resources bounded', info.textures < 120 && info.geometries < 300, JSON.stringify(info))

console.log(errors.length ? 'CONSOLE ISSUES:\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'no console errors/warnings')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
