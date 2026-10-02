// Real-pointer test of the Easter eggs (projects world points to the screen and clicks / hovers there).
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const W = 1280, H = 720
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`) }
await page.goto('http://localhost:3000/?debug=1&quality=low')
await page.waitForSelector('button:has-text("ENTER ALTERCO")', { timeout: 120000 })
await page.click('button:has-text("ENTER ALTERCO")')
await page.waitForTimeout(7000)
const settle = () => page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0015 && Math.abs(r.velocity) < 0.002 }, null, { timeout: 90000 }).catch(() => {})
const jump = async (p) => { await page.evaluate((p) => window.__hd.jump(p), p); await settle(); await page.waitForTimeout(2500) }
const screen = (x, y, z) => page.evaluate(([x, y, z]) => { const c = window.__camera; c.updateMatrixWorld(); const v = new c.position.constructor(x, y, z).project(c); return { sx: (v.x * 0.5 + 0.5) * innerWidth, sy: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 } }, [x, y, z])
const state = (fn) => page.evaluate(fn)

// 1. lamp
await jump(0.05)
let s = await screen(-1.95, 3.2, -4)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1500)
check('lamp: cursor becomes LAMP on hover', (await state(() => window.__hd.store.getState().cursor.kind)) === 'lamp', JSON.stringify(s))
await page.mouse.click(s.sx, s.sy); await page.waitForTimeout(1200)
check('lamp: click switches it off', (await state(() => window.__hd.store.getState().lamp)) === false)
await page.mouse.click(s.sx, s.sy); await page.waitForTimeout(1200)
check('lamp: click again switches it on', (await state(() => window.__hd.store.getState().lamp)) === true)

// 2. fire-escape number
await jump(0.24)
s = await screen(3.1, 5.9, -36.45)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1500)
const toast1 = await state(() => window.__hd.store.getState().toast?.text ?? '')
check('fire escape: hovering the stencil reveals a track number', /05/.test(toast1) || (await state(() => window.__hd.store.getState().eggs.includes('stencil'))), toast1)

// 3. puddle
await page.mouse.move(5, 5)
s = await screen(0.2, 0.02, -41)
await page.mouse.move(s.sx - 30, s.sy); await page.mouse.move(s.sx, s.sy, { steps: 6 }); await page.waitForTimeout(1500)
const toast2 = await state(() => window.__hd.store.getState().toast?.text ?? '')
check('puddle: hover distorts reality', (await state(() => window.__hd.store.getState().eggs.includes('puddle'))), toast2)

// 4. hidden letter hover
await jump(0.12)
s = await screen(-3.31, 2.1, -20.5)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1200)
check('graffiti letters: hovering a hidden tag registers it', (await state(() => window.__hd.store.getState().letters.filter(Boolean).length)) >= 1)

// 5. credits poster
await jump(0.5)
s = await screen(11.9, 1.75, -110.4)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1200)
check('credits poster: cursor is READ on hover', (await state(() => window.__hd.store.getState().cursor.label)) === 'READ', JSON.stringify(s))
await page.mouse.click(s.sx, s.sy); await page.waitForTimeout(1500)
check('credits poster: click opens the credits', (await state(() => window.__hd.store.getState().creditsOpen)) === true)
await page.keyboard.press('Escape'); await page.waitForTimeout(800)

// 6. wordmark ×7
for (let i = 0; i < 7; i++) await page.click('.wordmark')
await page.waitForTimeout(800)
check('HOODDINO wordmark ×7 triggers the surprise', await state(() => window.__hd.store.getState().eggs.includes('hood')))

// 6b. grazing-angle glyph: invisible up close, readable from afar
await jump(0.15)
s = await screen(-2.95, 1.2, -33.4)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1200)
check('grazing glyph: PORTAL cursor from far down the wall', (await state(() => window.__hd.store.getState().cursor.kind)) === 'portal', JSON.stringify(s))
await page.mouse.click(s.sx, s.sy); await page.waitForTimeout(1000)
check('grazing glyph: click registers the egg', await state(() => window.__hd.store.getState().eggs.includes('symbol')))
await page.mouse.move(5, 5)

// 7. portal poster → dualismo
await jump(0.27)
s = await screen(-3.6, 2.45, -50.2)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1500)
check('portal poster: cursor becomes PORTAL', (await state(() => window.__hd.store.getState().cursor.kind)) === 'portal', JSON.stringify(s))
await page.mouse.click(s.sx, s.sy)
await page.waitForFunction(() => window.__hd.rt.world === 'dualism' && window.__hd.rt.dual.t > 0.9, null, { timeout: 120000 }).catch(() => {})
check('portal poster: click pulls the camera into DUALISMO', (await state(() => window.__hd.rt.world)) === 'dualism')
check('DUALISMO is remembered (nav unlocks)', (await state(() => window.__hd.store.getState().dualismoFound)) === true)
await page.waitForTimeout(2000)
// 8. return rift
s = await screen(-604.3, -2.3, 3.2)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1200)
check('return rift: hover shows RETURN', (await state(() => window.__hd.store.getState().cursor.label)) === 'RETURN', JSON.stringify(s))
await page.mouse.click(s.sx, s.sy)
await page.waitForFunction(() => window.__hd.store.getState().mode === 'alterco' && window.__hd.rt.fx.tunnel < 0.05, null, { timeout: 120000 }).catch(() => {})
check('return rift: click goes back to ALTERCO', (await state(() => window.__hd.store.getState().mode)) === 'alterco')

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
console.log(`${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
