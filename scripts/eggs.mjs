// Real-pointer test of the Easter eggs (projects world points to the screen and clicks / hovers there).
import { chromium } from './browser.mjs'
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const W = 1280, H = 720
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`) }
await page.goto('http://localhost:3000/?debug=1&quality=low')
await page.waitForSelector('button:has-text("ENTER ALTERCO")', { timeout: 600000 })
await page.click('button:has-text("ENTER ALTERCO")', { force: true })
await page.waitForTimeout(7000)
const settle = () => page.waitForFunction(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0015 && Math.abs(r.velocity) < 0.002 }, null, { timeout: 90000 }).catch(() => {})
const jump = async (p) => { await page.evaluate((p) => window.__hd.jump(p), p); await settle(); await page.waitForTimeout(2500) }
const screen = (x, y, z) => page.evaluate(([x, y, z]) => { const c = window.__camera; c.updateMatrixWorld(); const v = new c.position.constructor(x, y, z).project(c); return { sx: (v.x * 0.5 + 0.5) * innerWidth, sy: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 } }, [x, y, z])
const state = (fn, arg) => page.evaluate(fn, arg)
const simWait = async (seconds) => {
  const start = await state(() => window.__hd.rt.time)
  await page.waitForFunction(([start, seconds]) => window.__hd.rt.time - start >= seconds, [start, seconds], { timeout: 120000, polling: 250 })
}

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
check('number 05 (fire-escape tag): resting the pointer on it registers it silently', (await state(() => window.__hd.store.getState().nums[4])) === true && toast1 === '', toast1)

// 3. puddle
await page.mouse.move(5, 5)
s = await screen(0.2, 0.02, -41)
await page.mouse.move(s.sx - 30, s.sy); await page.mouse.move(s.sx, s.sy, { steps: 6 }); await page.waitForTimeout(1500)
const toast2 = await state(() => window.__hd.store.getState().toast?.text ?? '')
check('puddle: the impossible puddle answers (no toast)', (await state(() => window.__hd.store.getState().eggs.includes('puddle'))) && toast2 === '', toast2)

// 4. hidden letter hover
await jump(0.12)
s = await screen(-3.31, 2.1, -20.5)
await page.mouse.move(s.sx, s.sy); await page.waitForTimeout(1200)
check('graffiti letters: hovering a hidden tag registers it', (await state(() => window.__hd.store.getState().letters.filter(Boolean).length)) >= 1)

// 4b. the rest of the 01–07 trail, each on its own physical object (hover = rest the pointer, touch = tap)
const trail = [
  [0, 0.04, 3.096, 1.5, 2.6, '01 stencil on the utility box'],
  [2, 0.12, 2.735, 1.62, -12.5, '03 number painted on the door'],
]
for (const [i, p, x, y, z, name] of trail) {
  await jump(p)
  s = await screen(x, y, z)
  await page.mouse.move(5, 5)
  // Pointer motion also moves the camera. Reproject after it settles and allow
  // actual simulation dwell; 1400 ms of software-GL wall time can be one frame.
  for (let aim = 0; aim < 3; aim++) {
    s = await screen(x, y, z)
    await page.mouse.move(s.sx, s.sy, { steps: 4 })
    await simWait(0.8)
    const after = await screen(x, y, z)
    const found = await state((i) => window.__hd.store.getState().nums[i], i)
    console.log('hover aim', JSON.stringify({ name, aim, projected: s, after, found }))
    if (found) break
  }
  check(`number ${name}`, (await state((i) => window.__hd.store.getState().nums[i], i)) === true, JSON.stringify(s))
}
check('numbers persist in localStorage', (await state(() => JSON.parse(localStorage.getItem('hd:nums') || '[]').filter(Boolean).length)) >= 3)

// 4c. the anamorphic mark: aligned camera = silent recognition
await jump(0.165)
await page.waitForTimeout(3500)
check('anamorphic ALTERCO: aligning with the scroll camera registers it (no popup)', (await state(() => window.__hd.store.getState().eggs.includes('anamorph') && !window.__hd.store.getState().toast)))

// 5. credits poster
await jump(0.385) // the plaza mouth: the walk through the installation has not started, the old vantage point is still there
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
// Aim at the actual centre: the legacy point was 5 cm behind this plane,
// which approaches its edge when projected at a grazing angle.
const glyphCentre = await state(() => {
  const matches=[]
  window.__scene.traverse(o=>{
    const u=o.material?.uniforms
    if(o.isMesh&&u?.uVis&&u?.uHover&&o.geometry?.parameters?.width===.9&&o.geometry?.parameters?.height===.9){
      const v=new window.__camera.position.constructor();o.getWorldPosition(v);matches.push(v.toArray())
    }
  })
  if(matches.length!==1)throw new Error('Expected exactly one grazing glyph')
  return matches[0]
})
const pointerSettled=()=>page.waitForFunction(()=>{const r=window.__hd.rt;return Math.abs(r.px-r.rx)<.002&&Math.abs(r.py-r.ry)<.002},null,{timeout:180000,polling:250})
let glyphAimStable=false
for(let aim=0;aim<3;aim++){
  s=await screen(...glyphCentre)
  await page.mouse.move(s.sx,s.sy,{steps:2})
  await pointerSettled();await simWait(.15)
  const after=await screen(...glyphCentre),shift=Math.hypot(after.sx-s.sx,after.sy-s.sy)
  const cursor=await state(()=>window.__hd.store.getState().cursor.kind)
  console.log('glyph aim',JSON.stringify({aim,centre:glyphCentre,point:s,after,shift,cursor}))
  if(shift<.4&&cursor==='portal'){glyphAimStable=true;break}
}
if(!glyphAimStable)throw new Error('Glyph pointer/camera did not settle within 0.4 CSS px')
check('grazing glyph: PORTAL cursor from far down the wall', (await state(() => window.__hd.store.getState().cursor.kind)) === 'portal', JSON.stringify(s))
// Click exactly the point that established hover, without a last-moment move.
await page.mouse.click(s.sx,s.sy,{delay:50});await simWait(.2)
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
check('the street remembers (dualReturned + persisted)', (await state(() => window.__hd.store.getState().dualReturned && localStorage.getItem('hd:dualret') === '1')))

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
console.log(`${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
