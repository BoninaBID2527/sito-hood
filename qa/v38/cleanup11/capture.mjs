// V3.8 task 11 — matching placement/keyboard inspection checkpoints.
// usage: node qa/v38/cleanup11/capture.mjs <outDir> <WxH> <quality> [from-to|n,n,..]
// env: PORT BUILD_DIR FULL_PLAZA=1 EXTRA_ROOM=1 TOUCH=1 DSF=1 WEBM=<test.webm>
// EXTRA='&…' (query) NOPOST=1 (disable bloom/grain/vignette for underlying-render QA)
import { chromium } from '../../../scripts/browser.mjs'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { runCheckpoint, CHECKPOINTS as STANDARD } from '../../../scripts/qa37-lib.mjs'
import { reflectionHealth } from '../../../scripts/reflection-health.mjs'
const rw = (x,y,z) => [1200+z,y,-67-x]
const rc=(pos,look,fov=45)=>({pos:rw(...pos),look:rw(...look),fov})
const S=(pos,look,fov=58)=>({pos,look,fov})
const custom=[]
for (const [i,z] of [18,3,-15,-33,-50,-67,-88,-109].entries()) for(const side of [-1,1]) {
 const x = z < -76 ? side*12 : side*([3.05,2.95,3.4,3,3.7,4.8][Math.min(5,i)]);
 custom.push({n:100+i*4+(side===1?2:0),name:`wall-${i}-${side===-1?'left':'right'}-front`,p:z < -76?.45:Math.min(.33,Math.max(0,(16-z)/250)),cam:S([0,2,z],[x,2.2,z],85)})
 custom.push({n:101+i*4+(side===1?2:0),name:`wall-${i}-${side===-1?'left':'right'}-grazing`,p:z < -76?.45:Math.min(.33,Math.max(0,(16-z)/250)),cam:S([side*1,1.7,z+5],[x,2,z-2],65)})
}
custom.push({n:140,name:'alterco-blade-front',p:.2,cam:S([0,4.6,-26],[2.15,5,-31],45)},
 {n:141,name:'alterco-blade-back',p:.2,cam:S([0,4.6,-36],[2.15,5,-31],45)},
 {n:142,name:'tracks-and-roof-hints',p:.327,cam:S([0,3.8,-63],[-.1,3.8,-68],75)},
 {n:143,name:'keyboard-front',roomCam:rc([-.1,1.13,-7.2],[-.1,.82,-7.97],42)},
 {n:144,name:'keyboard-side',roomCam:rc([-.9,1.1,-7.65],[-.2,.82,-7.98],42)},
 {n:145,name:'bio-headline-front',roomCam:rc([1.1,2.2,-4.45],[3.19,2.3,-4.45],62)},
 {n:146,name:'bio-headline-grazing',roomCam:rc([1.5,1.6,-2.8],[3.19,2.3,-4.45],55)},
 {n:147,name:'roof-bulkhead-front',p:.76,cam:S([594,1.8,9],[594,1.5,4],62)},
 {n:148,name:'roof-bulkhead-grazing',p:.76,cam:S([598.5,1.6,6],[594,1.3,4],58)},
 {n:149,name:'roof-parapet',p:.94,cam:S([605,1.6,-18],[605,.55,-24],68)},
 {n:150,name:'room-right-tags',roomCam:rc([1,1.35,-6.9],[3.2,1.3,-6.9],60)},
 {n:151,name:'room-left-tags',roomCam:rc([-1,1.3,-2.2],[-3.2,1.1,-2.2],60)},
 {n:152,name:'room-front-paper',roomCam:rc([1.4,1.35,-3.1],[2.3,1.3,-1.25],62)},
 {n:153,name:'letter-2-support',p:.2,cam:S([0,2.1,-21.3],[-3.4,2.1,-21.3],65)},
 {n:154,name:'letter-3-support',p:.27,cam:S([0,1.3,-33.15],[3.2,1.3,-33.15],65)},
 {n:155,name:'letter-5-support',p:.32,cam:S([0,1.9,-56.85],[3,1.9,-56.85],65)},
 {n:156,name:'one-way-front',p:.15,cam:S([0,2.1,-8.5],[-3.4,2.2,-10.5],50)},
 {n:157,name:'one-way-grazing',p:.15,cam:S([-1,2.1,-7.5],[-3.4,2.2,-10.5],55)})
const CHECKPOINTS = [...STANDARD.filter(c=>[1,2,3,4,5,6,7,8,35,36,37,41,42,50,56].includes(c.n) || (process.env.FULL_PLAZA === '1' && c.n >= 11 && c.n <= 34) || (process.env.EXTRA_ROOM === '1' && c.n >= 43 && c.n <= 49)),...custom]
const priority=(process.env.PRIORITY || '').split(',').filter(Boolean).flatMap(t=>{const [a,b]=t.split('-').map(Number);return Array.from({length:(b??a)-a+1},(_,i)=>a+i)})
if(priority.length)CHECKPOINTS.sort((a,b)=>(priority.includes(a.n)?priority.indexOf(a.n):priority.length)-(priority.includes(b.n)?priority.indexOf(b.n):priority.length))
const [out = 'shots-qa37', vp = '1280x720', quality = 'high', sel = ''] = process.argv.slice(2)
const [W, H] = vp.split('x').map(Number)
mkdirSync(out, { recursive: true })
const buildId = readFileSync(`${process.env.BUILD_DIR || '.next'}/BUILD_ID`, 'utf8').trim()
const previous = process.env.RESUME_SHOTS === '1' && existsSync(`${out}/manifest.json`) ? JSON.parse(readFileSync(`${out}/manifest.json`, 'utf8')) : null
if (previous && (previous.buildId !== buildId || previous.viewport !== vp || previous.quality !== quality || previous.noPost !== (process.env.NOPOST === '1') || Boolean(previous.noFog) !== (process.env.NOFOG === '1') || previous.errors.length)) throw new Error('Cannot resume a different build/configuration or failed console audit')
const want = (n) => { if (!sel) return true; return sel.split(',').some((t) => { const [a, b] = t.split('-').map(Number); return b ? n >= a && n <= b : n === a }) }
const recapture = new Set((process.env.RECAPTURE || '').split(',').filter(Boolean).map(Number))
if (recapture.size && (!previous || [...recapture].some(n => !want(n) || !CHECKPOINTS.some(cp => cp.n === n)))) throw new Error('Recapture requires a matching resumed manifest and selected checkpoint numbers')
const webm = process.env.WEBM ? readFileSync(process.env.WEBM) : null
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--remote-debugging-port=9334'] })
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: process.env.TOUCH === '1', isMobile: process.env.TOUCH === '1' })).newPage()
const errors = []
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/KHR_parallel|GPU stall|ReadPixels/.test(m.text()) && errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => errors.push(e.message))
if (webm) await page.route('**/hooddino-studio-arrangiamento.mp4', (r) => r.fulfill({ status: 200, body: webm, headers: { 'content-type': 'video/webm', 'accept-ranges': 'none' } }))
console.log('navigation starting');
await page.goto(`http://localhost:${process.env.PORT || 3000}/?debug=1&quality=${quality}${process.env.EXTRA || ''}`)
console.log('navigation ready');
await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
console.log('ENTER ready');
await page.click('button:has-text("ENTER")', { force: true, timeout: 120000 })
console.log('entered');
await page.waitForTimeout(6000)
await page.waitForFunction(() => window.__hd.A.brick.concrete.map.image.width >= 1280 || window.__hd.rt.quality.level === 0, null, { timeout: 600000, polling: 500 })
await page.addStyleTag({ content: '.overlay,.cursor,nextjs-portal{display:none !important}' })
if (process.env.NOPOST === '1') await page.evaluate(() => { window.__qaNoPost = true })
if (process.env.NOFOG === '1') await page.evaluate(() => { window.__scene.fog = null })
const log = []
const captures = (previous?.captures ?? []).filter(c => !recapture.has(c.n))
const resumedCaptures = captures.length
const persist = () => writeFileSync(`${out}/manifest.json`, JSON.stringify({ buildId, viewport: vp, quality, noPost: process.env.NOPOST === '1', noFog: process.env.NOFOG === '1', resumedCaptures, recaptured: [...new Set([...(previous?.recaptured ?? []), ...recapture])], captures, errors }, null, 2))
writeFileSync(`${out}/atlas.json`, JSON.stringify(await page.evaluate(()=>Object.fromEntries(['spr','pap'].map(k=>[k,Object.fromEntries(Object.entries(window.__hd.A.graf[k]).map(([id,c])=>[id,{aspect:c.aspect}]))]))),null,2));
console.log('ready for capture')
const until = (fn, arg, to = 600000) => page.waitForFunction(fn, arg, { timeout: to, polling: 150 })
const settle = () => until(() => { const r = window.__hd.rt; return Math.abs(r.smooth - r.progress) < 0.0008 && Math.abs(r.velocity) < 0.001 && (r.world !== 'alley' || r.smooth < 0.375 || r.smooth > 0.635 || (Math.abs(r.orbit.err) < 0.02 && Math.abs(r.orbit.vel) < 0.06)) })
const fixedVideoCamera = process.env.FIX_VIDEO_CAMERA === '1' ? rc([0.5, 1.27, -7], [0.5, 1.27, -8.3], 42) : null
const snapshot = () => page.evaluate(() => ({ camera: { position: window.__camera.position.toArray(), quaternion: window.__camera.quaternion.toArray(), fov: window.__camera.fov }, roomStation: window.__hd.room?.u, roomFocusPush: window.__hd.room?.push, world: window.__hd.rt.world, tier: window.__hd.rt.quality.tier, scale: window.__hd.rt.scale,
  calls: window.__hd.rt.stats.calls, triangles: window.__hd.rt.stats.tris, textures: window.__gl.info.memory.textures,
  geometries: window.__gl.info.memory.geometries, masonryWidth: window.__hd.A.brick.concrete.map.image.width,
  video: window.__hd.store.getState().video, videoTime: window.__hd.vid.el?.currentTime ?? null }))
try {
  for (const cp of CHECKPOINTS) {
    if (!want(cp.n) || captures.some(c => c.n === cp.n)) continue
    let shotState = null
    const onShot = cp.n === 45 && fixedVideoCamera ? async () => {
      await page.evaluate(c => { window.__hd.rt.camOverride = c }, fixedVideoCamera)
      await page.waitForTimeout(1800)
      // The inherited runner closes video focus immediately AFTER the image.
      // Record metadata before that close, while the depicted video is playing.
      shotState = await snapshot()
      await page.screenshot({ path: `${out}/${String(cp.n).padStart(2, '0')}-${cp.name}.png`, timeout: 240000 })
      log.push(`shot ${cp.n} ${cp.name} — fixed camera, metadata before closeFocus`)
    } : undefined
    await runCheckpoint(page, cp, out, { until, settle, log, onShot })
    const state = shotState ?? await snapshot()
    const reflections = await reflectionHealth(page)
    if (process.env.REQUIRE_FINITE_REFLECTIONS === '1' && reflections.some(r => r.nonfinite)) throw new Error(`Checkpoint ${cp.n}: non-finite reflection radiance`)
    captures.push({ reflections, n: cp.n, name: cp.name, inspectionCamera: cp.n === 45 && fixedVideoCamera ? fixedVideoCamera : cp.plaza ?? cp.roomCam ?? cp.cam ?? null, stateAtShot: Boolean(shotState), ...state })
    captures.sort((a, b) => a.n - b.n)
    persist()
    console.log(log.splice(0).join('\n'))
  }
} finally {
  try { await browser.close() } finally { persist() }
}

console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors/warnings')
if (errors.length) process.exitCode = 1
