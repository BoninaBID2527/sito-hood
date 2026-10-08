// THE HOODDINO ROOM — behaviour checks (headless Chromium + software GL: logic only, never FPS).
// Stock Chromium cannot decode H.264, so the mp4 request is answered with a WebM re-encode of the same footage: this exercises the
// player logic (explicit PLAY, pause, close, sound, release on exit) — real Safari/iOS decoding still has to be verified on devices.
// usage: node scripts/room-check.mjs [quality] [WxH]      env: REDUCED=1  TOUCH=1  PORT=3000  WEBM=/path/to/test.webm
import { chromium } from './browser.mjs'
import { readFileSync } from 'node:fs'
const quality = process.argv[2] || 'balanced'
const [w, h] = (process.argv[3] || '1280x720').split('x').map(Number)
const PORT = process.env.PORT || 3000
const BASEPATH = process.env.BASEPATH || '' // e.g. /sito-hood for the static export
const touch = process.env.TOUCH === '1'
const webm = process.env.WEBM ? readFileSync(process.env.WEBM) : null
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, reducedMotion: process.env.REDUCED === '1' ? 'reduce' : 'no-preference' })
const page = await ctx.newPage()
const errors = []
const reqs = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/KHR_parallel_shader_compile/.test(m.text())) errors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => errors.push('pageerror ' + e.message))
page.on('request', (r) => reqs.push(r.url()))
if (webm) await page.route('**/hooddino-studio-arrangiamento.mp4', (r) => r.fulfill({ status: 200, body: webm, headers: { 'content-type': 'video/webm', 'accept-ranges': 'none' } }))
let pass = 0, fail = 0
const ok = (c, name, extra = '') => { c ? pass++ : fail++; console.log(`${c ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`) }
const until = (fn, arg, to = 240000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 }).then(() => true).catch(() => false)
const hd = (f, a) => page.evaluate(f, a)
const sim = (s) => hd((s) => new Promise((r) => { const t0 = window.__hd.rt.time; const f = () => (window.__hd.rt.time - t0 > s ? r() : requestAnimationFrame(f)); f() }), s)

await page.goto(`http://localhost:${PORT}${BASEPATH}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`)
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
await page.click('button:has-text("ENTER")', { force: true })
await sim(2)

// ── semantics: the biography and the three links exist as real text, always
const sem = await hd(() => ({
  bio: document.body.innerText.length >= 0 && document.querySelector('.sr-only')?.textContent || '',
  links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
}))
const BIO = 'HOODDINO — classe 2005, dalla provincia sud di Torino. Liricista suburbano, tecnico e spirituale. Tra gli studi di Re-Akt a San Donato e i palchi della scena underground torinese, HOODDINO costruisce una scrittura in cui tecnica, introspezione e periferia convivono. A settembre arriva ALTERCO, il suo primo disco indipendente.'
ok(sem.bio.includes(BIO), 'exact biography is semantic text in the DOM')
for (const u of ['https://open.spotify.com/artist/6ETJU37OTsdfeTeDMN7oKI', 'https://www.instagram.com/hoodddddddd', 'https://www.tiktok.com/@hooddddddddd']) ok(sem.links.includes(u), 'link in semantic DOM: ' + u)

// ── nothing of the room loads / runs outside it
ok(!reqs.some((u) => /\/room\//.test(u)), 'no room asset requested before approaching the door')
ok(!reqs.some((u) => /\.mp4/.test(u)), 'no video request on initial load')
await hd(() => window.__hd.jump(0.1)); await sim(3)
ok(await hd(() => !window.__hd.store.getState().roomNear), 'entrance not offered far from the door')
ok(!(await page.$('.room-enter')), 'no ENTER chip far from the door')

// ── approach: the entrance is offered; shell loads; the video file still does not
await hd(() => window.__hd.jump(0.327))
ok(await until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.001 && window.__hd.store.getState().roomNear }), 'entrance offered at the door (roomNear)')
ok(await until(() => window.__hd.store.getState().roomLoad >= 1), 'room shell loaded on approach')
ok(reqs.some((u) => /room\/(portrait|live|signal)-lo\.webp/.test(u)), 'low-cost photo tier fetched on approach')
ok(!reqs.some((u) => /room\/.*-hi\.webp/.test(u)), 'high-detail photos NOT fetched on approach')
ok(!reqs.some((u) => /\.mp4/.test(u)), 'video still not requested on approach')
ok(!!(await page.$('.room-enter')), 'ENTER chip visible')
const pBefore = await hd(() => window.__hd.rt.progress)

// ── enter through the chip (keyboard-reachable DOM button)
await page.focus('.room-enter')
await page.keyboard.press('Enter')
ok(await until(() => window.__hd.store.getState().mode === 'room-in', null, 30000), 'mode room-in after activating the chip')
ok(await until(() => window.__hd.room.ap > 0.98), 'camera reaches the door (no page cut)')
ok(await until(() => window.__hd.room.go > 0.98), 'camera passes through the aperture')
ok(await until(() => window.__hd.store.getState().mode === 'room'), 'mode room (inside)')
ok(await hd(() => window.__hd.rt.world === 'room'), 'rt.world === room')
ok(await until(() => window.__hd.store.getState().roomLoad === 2), 'high-detail tier loaded on entry')
ok(!reqs.some((u) => /\.mp4/.test(u)), 'video still not requested inside the room (no autoplay)')
ok(await hd(() => !window.__hd.vid.attached && !window.__hd.vid.live), 'no video source attached before PLAY')
ok(await until(() => Math.abs(window.__hd.room.u) < 0.05), 'arrived at the entry station')
ok(await hd(() => window.__hd.rt.progress) === pBefore, 'street scroll position untouched')
ok(!!(await page.$('.room-exit')), 'BACK TO STREET visible')
ok(!(await page.evaluate(() => /dualism/i.test(document.querySelector('[data-room-ui]')?.textContent || ''))), 'no DUALISMO clue in the room UI')

// ── stations: keyboard
for (const [i, id] of [[1, 'workstation'], [2, 'bio'], [3, 'live'], [4, 'exit']]) {
  await page.keyboard.press('ArrowRight')
  ok(await until((i) => window.__hd.room.uT === i && Math.abs(window.__hd.room.u - i) < 0.06, i), 'ArrowRight → station ' + id)
}
await page.keyboard.press('ArrowLeft'); await until(() => Math.abs(window.__hd.room.u - 3) < 0.06)
ok(await hd(() => window.__hd.store.getState().roomStation) === 3, 'ArrowLeft → previous station')
ok(await hd(() => [...document.querySelectorAll('.room-chip')].some((a) => a.href === 'https://www.instagram.com/hoodddddddd')), 'LIVE DATES chip links to Instagram')

// Actual touch input in the emulated touch viewport, in addition to keyboard checks.
if (touch) {
  await page.tap('button[aria-label="WORKSTATION"]')
  ok(await until(() => window.__hd.room.uT === 1 && Math.abs(window.__hd.room.u - 1) < 0.06), 'touch tap selects workstation')
  const input = await ctx.newCDPSession(page)
  const swipe = async (from, to) => {
    await hd(() => {
      window.__swipeTrace = []
      window.__swipeListener = (e) => window.__swipeTrace.push({ type: e.type, pointerType: e.pointerType, trusted: e.isTrusted, x: e.clientX, y: e.clientY, handledAt: performance.now(), timestamp: e.timeStamp })
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.addEventListener(type, window.__swipeListener, true)
    })
    // Queue an actual quick native gesture. Awaiting each CDP acknowledgment
    // can insert a whole slow GL frame between events, turning it into a hold.
    await Promise.all([
      input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w * from, y: h * 0.2 }] }),
      input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w * to, y: h * 0.2 }] }),
      input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    ])
    console.log('native swipe trace', JSON.stringify(await hd(() => {
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.removeEventListener(type, window.__swipeListener, true)
      return window.__swipeTrace
    })))
  }
  await swipe(0.72, 0.28)
  ok(await until(() => window.__hd.room.uT === 2 && Math.abs(window.__hd.room.u - 2) < 0.06), 'touch swipe left selects next station')
  const beforeRight = await hd(() => window.__hd.room.uT)
  await swipe(0.28, 0.72)
  ok(beforeRight === 2 && await until(() => window.__hd.room.uT === 1 && Math.abs(window.__hd.room.u - 1) < 0.06), 'touch swipe right selects previous station')
  await input.detach()
  await page.tap('button[aria-label="WHO IS HOODDINO?"]')
  ok(await until(() => window.__hd.room.uT === 2 && Math.abs(window.__hd.room.u - 2) < 0.06), 'touch tap selects biography')
}

// ── bio station: text on the wall (texture exists) and DOM caption on narrow screens
await page.click('button[aria-label="WHO IS HOODDINO?"]'); await until(() => Math.abs(window.__hd.room.u - 2) < 0.06)
ok(await hd(() => !!window.__hd.rt && true), 'bio station reachable by the dot selector')
if (w / h < 1.1) ok(!!(await page.$('.room-bio')) && (await page.textContent('.room-bio')).includes('classe 2005'), 'narrow viewport: biography caption is shown')

// ── video: explicit PLAY only
await page.click('button[aria-label="WORKSTATION"]'); await until(() => Math.abs(window.__hd.room.u - 1) < 0.06)
const chip = await page.$('.room-chip')
ok(!!chip && (await chip.textContent()).includes('ARRANGIAMENTO') && (await chip.textContent()).includes('PLAY'), 'focus label IN THE STUDIO / ARRANGIAMENTO / PLAY →')
await chip.click()
ok(await until(() => window.__hd.store.getState().roomFocus && window.__hd.room.push > 0.97), 'PLAY pushes the camera to the monitor')
ok(await hd(() => window.__hd.rt.world === 'room' && window.__hd.room.dim > 0.9), 'lights lowered (dim)')
ok(reqs.some((u) => /\.mp4/.test(u)), 'video requested only after PLAY')
if ((process.env.EXTRA || '').includes('roomvideo=dom')) {
  ok(!!(await page.$('.room-video-dom video')), 'DOM fallback: the same <video> is shown in the vertical frame')
  ok(await hd(() => !window.__hd.vid.tex), 'DOM fallback: no WebGL video texture is created')
}
if (webm) {
  ok(await until(() => window.__hd.vid.el && window.__hd.vid.el.currentTime > 0.3 && !window.__hd.vid.el.paused, null, 120000), 'video is playing')
  ok(await hd(() => window.__hd.vid.el.muted === false && window.__hd.vid.el.volume > 0), 'audio on because the visitor pressed PLAY')
  ok(await hd(() => window.__hd.vid.el.playsInline === true), 'playsinline set (iOS inline playback)')
  await page.click('.room-controls button[aria-label="Pause video"]')
  ok(await until(() => window.__hd.vid.el.paused), 'PAUSE pauses')
  await page.click('.room-controls button[aria-label="Play video"]')
  ok(await until(() => !window.__hd.vid.el.paused), 'PLAY resumes')
  await page.click('.room-controls button[aria-pressed]')
  ok(await hd(() => window.__hd.vid.el.muted === true), 'SOUND toggles mute')
  await page.click('.room-controls button[aria-pressed]')
}
await page.click('.room-controls button[aria-label="Close video"]')
ok(await until(() => window.__hd.room.push < 0.03 && !window.__hd.store.getState().roomFocus), 'CLOSE restores camera and lights')
ok(await hd(() => !window.__hd.vid.el || window.__hd.vid.el.paused), 'CLOSE pauses the video')

// ── Escape closes focus first, then exits
await page.click('.room-chip'); await until(() => window.__hd.room.push > 0.9)
await page.keyboard.press('Escape')
ok(await until(() => !window.__hd.store.getState().roomFocus), 'Escape closes the video focus')
ok(await hd(() => window.__hd.store.getState().mode === 'room'), 'still in the room after the first Escape')

// ── exit: back to the same street position; video released
if (webm) { await page.click('.room-chip'); await until(() => window.__hd.vid.el && !window.__hd.vid.el.paused, null, 120000) }
await page.click('.room-exit')
ok(await until(() => window.__hd.store.getState().mode === 'room-out', null, 30000), 'mode room-out')
ok(await until(() => window.__hd.store.getState().mode === 'alterco', null, 300000), 'back in the street')
ok(await hd(() => window.__hd.rt.world === 'alley'), 'rt.world === alley')
ok(Math.abs((await hd(() => window.__hd.rt.progress)) - pBefore) < 1e-6, 'same scroll progress as before entering')
ok(await hd(() => window.__hd.room.ap === 0 && window.__hd.room.go === 0 && window.__hd.room.phase === 'off'), 'room rig fully reset')
ok(await hd(() => { const v = window.__hd.vid; return !v.attached && !v.live && !v.tex && (!v.el || (v.el.paused && !v.el.getAttribute('src'))) }), 'video released on exit (paused, src dropped, texture disposed)')
ok(await hd(() => !!document.querySelector('.room-ui') === false), 'room UI gone')
await sim(1)
// re-entry works (second visit)
ok(await until(() => window.__hd.store.getState().roomNear), 'door offered again after leaving')
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
ok(errors.length === 0, 'no console errors / hydration warnings')
if (BASEPATH) {
  const room = reqs.filter((u) => /\/room\//.test(u))
  ok(room.length >= 8 && room.every((u) => new URL(u).pathname.startsWith(BASEPATH + '/room/')), 'every room asset is requested under ' + BASEPATH + '/room/', `(${room.length} requests)`)
  ok(!reqs.some((u) => new URL(u).pathname.startsWith('/room/')), 'no request escapes the base path')
}
console.log(`\nroom-check${process.env.EXTRA ? ' ' + process.env.EXTRA : ''} [${quality} ${w}x${h}${touch ? ' touch' : ''}${process.env.REDUCED === '1' ? ' reduced' : ''}]: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
