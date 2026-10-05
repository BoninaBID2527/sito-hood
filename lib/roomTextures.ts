import * as THREE from 'three'
import { rng } from './math'
import { makeCanvas, toTexture, grain, nextFrame, track } from './paint'
import { Atlas, FONT, applyAge, drawBlock, drawHand, drawStencil, drawSymbol, drawSticker, paper, scrap, drawBigPoster, type Cell } from './graffiti'
import { roomBio, roomCopy, roomMedia } from '@/data/room'
import { rt } from './runtime'

/**
 * THE HOODDINO ROOM — texture registry. Three staged builds, matching the loading strategy:
 *   shell   (approach)   small procedural surfaces + the low-cost photo tier + the video poster
 *   detail  (room entry) the typographic walls, the paste-up atlas, the high-detail photo tier
 * Everything is generated on canvases (no extra network beyond the photographs) and is shared between meshes.
 * Sizes follow the quality tier (rt.quality.level: 3 ultra … 0 mobile).
 */
export interface RoomTextures {
  shellReady: boolean
  detailReady: boolean
  wall: THREE.Texture
  floor: THREE.Texture
  foam: THREE.Texture
  fabricRed: THREE.Texture
  fabricSlate: THREE.Texture
  wood: THREE.Texture
  keys: THREE.Texture
  daw: THREE.Texture
  phone: THREE.Texture
  screenGlow: THREE.Texture
  blob: THREE.Texture
  portrait: THREE.Texture
  live: THREE.Texture
  signal: THREE.Texture
  poster: THREE.Texture
  /** the poster with a restrained play mark — what the monitor shows until the visitor presses PLAY */
  posterPlay: THREE.Texture
  /** high-detail swaps (assigned over the low tier on entry) */
  portraitHi?: THREE.Texture
  liveHi?: THREE.Texture
  signalHi?: THREE.Texture
  headline?: THREE.Texture
  paragraph?: THREE.Texture
  meta?: THREE.Texture
  liveCard?: THREE.Texture
  atlas?: THREE.Texture
  cells?: Record<string, Cell>
}

export const RX = {} as RoomTextures
RX.shellReady = false
RX.detailReady = false

type Ctx = CanvasRenderingContext2D
const mono = FONT.mono

/** texture edge length for the current tier */
const S = (hi: number) => (rt.quality.level >= 2 ? hi : rt.quality.level === 1 ? hi * 0.75 : hi * 0.5)

const loader = new THREE.TextureLoader()
const loadTex = (url: string) =>
  new Promise<THREE.Texture>((res, rej) =>
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = rt.quality.level >= 2 ? 8 : 4
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      track(t)
      res(t)
    }, undefined, rej),
  )

/** soft irregular stains (damp, dirt, hands) */
function stain(ctx: Ctx, w: number, h: number, n: number, color: string, seed: number) {
  const r = rng(seed)
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.5
    ctx.beginPath()
    ctx.ellipse(r() * w, r() * h, w * (0.02 + r() * 0.08), h * (0.02 + r() * 0.1), r() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const wrap = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t }

/* ───────────────────────── surfaces ───────────────────────── */

/** painted block wall: roller streaks, chipped paint over raw concrete, rising damp, scuffs */
function paintWall(size: number, seed: number, base: string, band: string) {
  const { canvas, ctx } = makeCanvas(size, size)
  const r = rng(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  // vertical roller streaks
  for (let i = 0; i < 90; i++) {
    const x = r() * size, w = 6 + r() * 40
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'
    ctx.fillRect(x, 0, w, size)
  }
  // lower band (dado) — a darker tone with a hand-cut edge
  const y0 = size * 0.62
  ctx.fillStyle = band
  ctx.beginPath()
  ctx.moveTo(0, y0)
  for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.03) * 3 + (r() - 0.5) * 3)
  ctx.lineTo(size, size)
  ctx.lineTo(0, size)
  ctx.fill()
  // blocks / mortar lines of a cinder-block wall
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 2
  const bh = size / 8
  for (let y = 0; y <= size; y += bh) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke() }
  for (let row = 0; row < 8; row++) for (let x = (row % 2) * (size / 8); x < size; x += size / 4) { ctx.beginPath(); ctx.moveTo(x, row * bh); ctx.lineTo(x, (row + 1) * bh); ctx.stroke() }
  // chips: the raw concrete under the paint
  for (let i = 0; i < 70; i++) {
    const x = r() * size, y = r() * size, w = 4 + r() * 22, h = 3 + r() * 12
    ctx.fillStyle = `rgba(${120 + r() * 40},${116 + r() * 36},${108 + r() * 30},${0.35 + r() * 0.4})`
    ctx.beginPath()
    ctx.ellipse(x, y, w, h, r() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  stain(ctx, size, size, 26, 'rgba(0,0,0,0.07)', seed + 3)
  grain(ctx, size, size, 0.05, seed + 5)
  return wrap(toTexture(canvas, { aniso: 8, wrap: true }))
}

function floorTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const r = rng(77)
  ctx.fillStyle = '#242322'
  ctx.fillRect(0, 0, size, size)
  stain(ctx, size, size, 40, 'rgba(0,0,0,0.12)', 4)
  stain(ctx, size, size, 18, 'rgba(120,110,100,0.07)', 5)
  // saw-cut expansion joints
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke()
  // scuffs and a couple of old paint drips
  for (let i = 0; i < 60; i++) { ctx.strokeStyle = `rgba(200,190,170,${0.03 + r() * 0.05})`; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); const x = r() * size, y = r() * size; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60); ctx.stroke() }
  for (let i = 0; i < 5; i++) { ctx.fillStyle = ['rgba(200,50,40,0.5)', 'rgba(60,110,200,0.4)', 'rgba(240,200,60,0.4)'][i % 3]; ctx.beginPath(); ctx.ellipse(r() * size, r() * size, 3 + r() * 8, 2 + r() * 5, r() * 3, 0, Math.PI * 2); ctx.fill() }
  grain(ctx, size, size, 0.06, 9)
  return wrap(toTexture(canvas, { aniso: 8, wrap: true }))
}

/** acoustic foam: a grid of pyramids lit from the top-left */
function foamTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const n = 8, c = size / n
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * c, y = j * c
    // four faces of the pyramid
    const faces: [string, number[][]][] = [
      ['#34353a', [[x, y], [x + c, y], [x + c / 2, y + c / 2]]],
      ['#1c1c20', [[x + c, y], [x + c, y + c], [x + c / 2, y + c / 2]]],
      ['#121214', [[x, y + c], [x + c, y + c], [x + c / 2, y + c / 2]]],
      ['#26272b', [[x, y], [x, y + c], [x + c / 2, y + c / 2]]],
    ]
    for (const [col, pts] of faces) { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.fill() }
  }
  stain(ctx, size, size, 14, 'rgba(255,255,255,0.025)', 3)
  grain(ctx, size, size, 0.05, 2)
  return wrap(toTexture(canvas, { aniso: 4, wrap: true }))
}

function fabricTex(size: number, base: string, thread: string, seed: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const r = rng(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = thread
  for (let y = 0; y < size; y += 3) { ctx.globalAlpha = 0.18 + r() * 0.12; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke() }
  for (let x = 0; x < size; x += 3) { ctx.globalAlpha = 0.1 + r() * 0.1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke() }
  ctx.globalAlpha = 1
  stain(ctx, size, size, 18, 'rgba(0,0,0,0.12)', seed + 1)
  grain(ctx, size, size, 0.05, seed + 2)
  return wrap(toTexture(canvas, { aniso: 4, wrap: true }))
}

function woodTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const r = rng(31)
  ctx.fillStyle = '#4b3524'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 220; i++) { const y = r() * size; ctx.strokeStyle = `rgba(${20 + r() * 40},${10 + r() * 24},5,${0.1 + r() * 0.2})`; ctx.lineWidth = 0.6 + r() * 2.2; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.012 + i) * 3 + (r() - 0.5) * 1.5); ctx.stroke() }
  // wear: pale scratches and ring marks from mugs
  for (let i = 0; i < 50; i++) { ctx.strokeStyle = `rgba(230,200,160,${0.04 + r() * 0.06})`; ctx.lineWidth = 1; ctx.beginPath(); const x = r() * size, y = r() * size; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 20); ctx.stroke() }
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(size * 0.72, size * 0.4, size * 0.04, 0, Math.PI * 2); ctx.stroke()
  grain(ctx, size, size, 0.05, 3)
  return wrap(toTexture(canvas, { aniso: 4, wrap: true }))
}

function keysTex() {
  const W = 1024, H = 192
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#111114'
  ctx.fillRect(0, 0, W, H)
  // controller section (pads + knobs)
  ctx.fillStyle = '#1d1d22'; ctx.fillRect(10, 8, W - 20, 78)
  for (let i = 0; i < 8; i++) { ctx.fillStyle = '#34343c'; ctx.beginPath(); ctx.arc(60 + i * 56, 46, 16, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9aa6'; ctx.fillRect(58 + i * 56, 32, 4, 12) }
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 3 === 0 ? '#e5483c' : '#2a2b32'; ctx.fillRect(540 + (i % 4) * 62, 16 + Math.floor(i / 4) * 34, 52, 28) }
  ctx.fillStyle = '#7fe3ff'; ctx.fillRect(500, 20, 20, 6)
  // keys
  const kw = (W - 20) / 29
  for (let i = 0; i < 29; i++) { ctx.fillStyle = '#d9d4c6'; ctx.fillRect(10 + i * kw + 1, 94, kw - 2, H - 100) }
  const black = [1, 2, 4, 5, 6]
  for (let i = 0; i < 28; i++) if (black.includes(i % 7)) { ctx.fillStyle = '#0c0c0e'; ctx.fillRect(10 + (i + 1) * kw - kw * 0.3, 94, kw * 0.6, (H - 100) * 0.62) }
  grain(ctx, W, H, 0.06, 6)
  return toTexture(canvas, { aniso: 4 })
}

/** abstract arrangement view for the secondary DAW monitor — lanes and clips, no text, nothing readable to invent */
function dawTex() {
  const W = 512, H = 320
  const { canvas, ctx } = makeCanvas(W, H)
  const r = rng(12)
  ctx.fillStyle = '#12151b'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#1b2029'; ctx.fillRect(0, 0, W, 22)
  const cols = ['#3d8bd9', '#d9533d', '#e0a43a', '#4cbf8b', '#9a6ad6']
  for (let l = 0; l < 9; l++) {
    const y = 30 + l * 31
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, y - 2, W, 1)
    ctx.fillStyle = '#1a1f28'; ctx.fillRect(0, y, 60, 28)
    let x = 66 + r() * 20
    while (x < W - 30) {
      const w = 30 + r() * 120
      ctx.fillStyle = cols[(l + Math.floor(r() * 2)) % cols.length]
      ctx.globalAlpha = 0.55 + r() * 0.3
      ctx.fillRect(x, y, Math.min(w, W - x - 8), 26)
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      for (let k = 0; k < Math.min(w, W - x - 8); k += 5) { const h = 3 + r() * 16; ctx.fillRect(x + k, y + 13 - h / 2, 2, h) }
      x += w + 8 + r() * 30
    }
  }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(268, 22, 2, H - 22)
  grain(ctx, W, H, 0.05, 8)
  return toTexture(canvas, { aniso: 2, mipmaps: false })
}

function phoneTex() {
  const { canvas, ctx } = makeCanvas(64, 128)
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, '#0e1a28'); g.addColorStop(1, '#2a1018')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(20, 6, 24, 3)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(8, 108, 48, 3)
  return toTexture(canvas, { aniso: 1, mipmaps: false })
}

function screenGlowTex() {
  const S = 64
  const { canvas, ctx } = makeCanvas(S, S)
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
  return toTexture(canvas, { mipmaps: false, aniso: 1 })
}

/** soft contact shadow (multiplied dark blob) */
function blobTex() {
  const S = 64
  const { canvas, ctx } = makeCanvas(S, S)
  ctx.shadowColor = '#000'; ctx.shadowBlur = 9
  ctx.fillStyle = '#000'; ctx.fillRect(14, 14, S - 28, S - 28)
  return toTexture(canvas, { mipmaps: false, aniso: 1 })
}

function posterWithPlay(po: THREE.Texture) {
  const W = 256, H = 427
  const { canvas, ctx } = makeCanvas(W, H)
  const img = po.image as CanvasImageSource
  ctx.drawImage(img, 0, 0, W, H)
  // darken (it is a screen idling in a dim room), then a thin ring + triangle
  ctx.fillStyle = 'rgba(8,10,16,0.34)'; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(W / 2, H * 0.52, 34, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath(); ctx.moveTo(W / 2 - 9, H * 0.52 - 15); ctx.lineTo(W / 2 + 17, H * 0.52); ctx.lineTo(W / 2 - 9, H * 0.52 + 15); ctx.closePath(); ctx.fill()
  return toTexture(canvas, { aniso: 4 })
}

/* ───────────────────────── staged builds ───────────────────────── */

/** approach: procedural surfaces + low-cost photographs + the poster still. Returns when everything is ready (never throws). */
export async function loadRoomShell() {
  if (RX.shellReady) return
  const s = S(1024)
  const steps: (() => void | Promise<void>)[] = [
    () => { RX.wall = paintWall(s, 21, '#4a565a', '#2e373b') },
    () => { RX.floor = floorTex(S(512)) },
    () => { RX.foam = foamTex(S(256)) },
    () => { RX.fabricRed = fabricTex(S(256), '#4a1a1c', '#7a2c2a', 41); RX.fabricSlate = fabricTex(S(256), '#252a31', '#46505c', 42) },
    () => { RX.wood = woodTex(S(512)) },
    () => { RX.keys = keysTex(); RX.daw = dawTex(); RX.phone = phoneTex(); RX.screenGlow = screenGlowTex(); RX.blob = blobTex() },
    async () => {
      const [p, l, sg, po] = await Promise.all([loadTex(roomMedia.portrait.lo), loadTex(roomMedia.live.lo), loadTex(roomMedia.signal.lo), loadTex(roomMedia.poster)])
      RX.portrait = p; RX.live = l; RX.signal = sg; RX.poster = po
      RX.posterPlay = posterWithPlay(po)
    },
  ]
  for (const st of steps) { await st(); await nextFrame() }
  RX.shellReady = true
}

/** room entry: typographic walls, the paste-up atlas and the high-detail photographs */
export async function loadRoomDetail() {
  if (RX.detailReady) return
  const hiPhotos = rt.quality.level >= 1
  const [portraitHi, liveHi, signalHi] = hiPhotos
    ? await Promise.all([loadTex(roomMedia.portrait.hi), loadTex(roomMedia.live.hi), loadTex(roomMedia.signal.hi)]).catch(() => [undefined, undefined, undefined] as const)
    : ([undefined, undefined, undefined] as const)
  RX.portraitHi = portraitHi; RX.liveHi = liveHi; RX.signalHi = signalHi
  await nextFrame()
  RX.headline = headlineTex()
  await nextFrame()
  RX.paragraph = paragraphTex()
  RX.meta = metaTex()
  RX.liveCard = liveCardTex()
  await nextFrame()
  const at = buildRoomAtlas()
  RX.atlas = at.texture; RX.cells = at.cells
  RX.detailReady = true
}

/* ───────────────────────── typographic walls ───────────────────────── */

/** WHO IS / HOODDINO? — painted on the wall (block lettering, sprayed with a roller-white underlay) */
function headlineTex() {
  const W = Math.round(S(1536)), H = Math.round(S(640))
  const { canvas, ctx } = makeCanvas(W, H)
  const k = W / 1536
  ctx.save()
  ctx.scale(k, k)
  ctx.translate(0, 0)
  const [a, b] = roomBio.headline
  drawBlock(ctx, 1536, 250, { text: a, face: '#f0e6d0', face2: '#d6c9ae', outline: '#101216', shade: '#c8302b', seed: 301, depth: 12, rot: -0.012 })
  ctx.translate(0, 260)
  drawBlock(ctx, 1536, 360, { text: b, face: '#f0e6d0', face2: '#d6c9ae', outline: '#101216', shade: '#1d4fb8', seed: 302, depth: 14, rot: 0.01 })
  ctx.restore()
  applyAge(ctx, W, H, { fade: 0.1, erase: 0.14, seed: 311 })
  return toTexture(canvas, { aniso: 8 })
}

/** the exact biography on a photocopied sheet pasted to the wall (readable; also exposed as real text in the DOM) */
function paragraphTex() {
  const W = Math.round(S(1536)), H = Math.round(S(1152))
  const { canvas, ctx } = makeCanvas(W, H)
  const k = W / 1536
  ctx.save()
  ctx.scale(k, k)
  const w = 1536, h = 1152
  paper(ctx, w, h, { bg: '#e8e2d2', seed: 322, fade: 0.08, yellow: 0.1, torn: 0.7 }, () => {
    ctx.fillStyle = '#14120f'
    ctx.textBaseline = 'alphabetic'
    // wrap the paragraph on measured width
    const px = 50
    ctx.font = `bold ${px}px ${mono}`
    const maxW = w - 190
    const words = roomBio.paragraph.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const wd of words) {
      const t = cur ? cur + ' ' + wd : wd
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd } else cur = t
    }
    lines.push(cur)
    const lh = px * 1.5
    let y = (h - lines.length * lh) / 2 + px * 0.9
    ctx.fillStyle = 'rgba(229,72,60,0.28)'
    // marker highlight over the opening name
    ctx.fillRect(92, y - px * 0.85, ctx.measureText('HOODDINO').width + 8, px * 1.12)
    ctx.fillStyle = '#14120f'
    for (const ln of lines) { ctx.fillText(ln, 96, y); y += lh }
    // registration marks
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(60, 120); ctx.lineTo(60, 60); ctx.lineTo(120, 60); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(w - 60, h - 120); ctx.lineTo(w - 60, h - 60); ctx.lineTo(w - 120, h - 60); ctx.stroke()
  })
  ctx.restore()
  return toTexture(canvas, { aniso: 8 })
}

/** 2005 / SOUTH OF TURIN — LIRICISTA SUBURBANO / TECNICO / SPIRITUALE, stencilled low on the wall */
function metaTex() {
  const W = Math.round(S(1536)), H = Math.round(S(256))
  const { canvas, ctx } = makeCanvas(W, H)
  const k = W / 1536
  ctx.save(); ctx.scale(k, k)
  drawStencil(ctx, 1536, 120, { text: roomBio.meta[0], color: '#e8e0cc', seed: 331, holes: 34 })
  ctx.translate(0, 128)
  drawStencil(ctx, 1536, 120, { text: roomBio.meta[1], color: '#e8e0cc', seed: 332, holes: 34, font: 'bungee' })
  ctx.restore()
  applyAge(ctx, W, H, { fade: 0.14, erase: 0.2, seed: 333 })
  return toTexture(canvas, { aniso: 8 })
}

/** LIVE DATES / UPDATED ON INSTAGRAM ↗ — a printed card taped under the live print (no dates, nothing invented) */
function liveCardTex() {
  const W = Math.round(S(768)), H = Math.round(S(512))
  const { canvas, ctx } = makeCanvas(W, H)
  const k = W / 768
  ctx.save(); ctx.scale(k, k)
  paper(ctx, 768, 512, { bg: '#efe9da', seed: 341, fade: 0.06, yellow: 0.08, torn: 0.5 }, () => {
    ctx.fillStyle = '#14120f'
    ctx.font = `150px ${FONT.anton}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(roomCopy.live[0], 48, 220)
    ctx.fillStyle = '#c8302b'; ctx.fillRect(48, 250, 520, 8)
    ctx.fillStyle = '#14120f'
    ctx.font = `bold 40px ${mono}`
    ctx.fillText(roomCopy.live[1], 48, 332)
    ctx.font = `bold 22px ${mono}`
    ctx.fillStyle = 'rgba(20,18,15,0.6)'
    ctx.fillText('INSTAGRAM.COM/HOODDDDDDDD', 48, 440)
  })
  ctx.restore()
  return toTexture(canvas, { aniso: 8 })
}

/* ───────────────────────── paste-up atlas ───────────────────────── */

/** decals that dress the walls: layered paint, stickers, tape, paper — one atlas, one draw call */
function buildRoomAtlas() {
  const size = rt.quality.level >= 2 ? 2048 : rt.quality.level === 1 ? 1536 : 1024
  const sc = size / 2048
  const at = new Atlas(2048, 2048, sc)
  const specs: Parameters<Atlas['pack']>[0] = []
  const add = (id: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, age?: Parameters<typeof applyAge>[3]) =>
    specs.push({ id, w, h, draw: (c, ww, hh) => { draw(c, ww, hh); if (age) applyAge(c, ww, hh, age) } })
  // layered flat paint (rollered colour fields, the "wall under the wall")
  const field = (id: string, col: string, seed: number, w = 480, h = 360) => add(id, w, h, (c, ww, hh) => {
    const r = rng(seed)
    c.fillStyle = col
    c.beginPath(); c.moveTo(6, 8); for (let i = 1; i < 14; i++) c.lineTo((ww * i) / 14, 6 + r() * 14); c.lineTo(ww - 6, 8)
    for (let i = 1; i < 12; i++) c.lineTo(ww - 6 - r() * 10, (hh * i) / 12); c.lineTo(ww - 6, hh - 8)
    for (let i = 13; i > 0; i--) c.lineTo((ww * i) / 14, hh - 6 - r() * 14); c.lineTo(6, hh - 8)
    for (let i = 11; i > 0; i--) c.lineTo(6 + r() * 10, (hh * i) / 12); c.closePath(); c.fill()
    stain(c, ww, hh, 10, 'rgba(0,0,0,0.12)', seed + 1)
  }, { fade: 0.08, erase: 0.25, seed: seed + 2 })
  field('fld_red', '#8e2a26', 501)
  field('fld_blue', '#244a8c', 502)
  field('fld_ochre', '#b88a2c', 503, 420, 300)
  field('fld_dark', '#17181c', 504, 520, 380)
  add('blk_hd', 760, 240, (c, w, h) => drawBlock(c, w, h, { text: 'HOODDINO', face: '#e5483c', face2: '#a82b2b', outline: '#0d0e12', shade: '#16306e', seed: 511, depth: 12, rot: -0.02 }), { fade: 0.18, erase: 0.3, paintOver: 0.22, cover: '#33403f', seed: 512 })
  add('hand_hd', 300, 170, (c, w, h) => drawHand(c, w, h, { text: 'HD', face: 'marker', color: '#f2eee6', seed: 513, rot: 0.08, underline: true, drips: 2 }), { fade: 0.1, erase: 0.12, seed: 514 })
  add('hand_2005', 320, 160, (c, w, h) => drawHand(c, w, h, { text: '2005', face: 'salt', color: '#e8c548', seed: 515, rot: -0.07 }), { fade: 0.16, erase: 0.2, seed: 516 })
  add('st_alterco', 520, 120, (c, w, h) => drawStencil(c, w, h, { text: 'ALTERCO', color: '#b8322a', seed: 517, holes: 40 }), { fade: 0.28, erase: 0.34, seed: 518 })
  add('st_eye', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'eye', '#d8d2c0', 519), { fade: 0.14, erase: 0.14, seed: 520 })
  add('st_cross', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'crosshair', '#7fa8ff', 521), { fade: 0.1, seed: 522 })
  add('st_arrow', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'arrow', '#e8c548', 523), { fade: 0.22, erase: 0.28, seed: 524 })
  add('st_barcode', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'barcode', '#d8d2c0', 525), { fade: 0.2, seed: 526 })
  add('stk_a', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'hd', seed: 531, bg: '#14161c', fg: '#f4efe6' }))
  add('stk_b', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'eye', seed: 532, bg: '#2a5ac8', fg: '#f4efe6' }))
  add('stk_c', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'seven', seed: 533, bg: '#b8322a', fg: '#f4efe6' }))
  add('stk_d', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'alt', seed: 534, bg: '#e0b840', fg: '#14110c' }))
  add('tape', 160, 52, (c, w, h) => { c.fillStyle = 'rgba(224,214,176,0.78)'; c.fillRect(2, 4, w - 4, h - 8); for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(0,0,0,0.05)'; c.fillRect(2, 4 + i * 7, w - 4, 1) } }, { seed: 535 })
  add('paper_a', 320, 448, (c, w, h) => drawBigPoster(c, w, h, { lines: ['2005'], sub: 'SUD DI TORINO', seed: 541, pal: 1, halftone: true }))
  add('paper_b', 288, 220, (c, w, h) => paper(c, w, h, { bg: '#d8d0bc', seed: 542, fade: 0.1, yellow: 0.12, torn: 1.4 }, () => { c.fillStyle = '#14120f'; c.font = `${h * 0.5}px ${FONT.anton}`; c.fillText('HD', w * 0.08, h * 0.66); scrap(c, w * 0.5, h * 0.12, w * 0.4, h * 0.3, '#c8302b', 543, 2) }))
  add('paper_c', 260, 340, (c, w, h) => paper(c, w, h, { bg: '#ece8dd', seed: 544, fade: 0.1, yellow: 0.1, torn: 1 }, () => { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(w * 0.1, h * (0.12 + i * 0.09)); c.lineTo(w * (0.45 + 0.4 * rng(i + 7)()), h * (0.12 + i * 0.09)); c.stroke() } }))
  at.pack(specs)
  return { texture: at.texture(), cells: at.cells }
}

export function disposeRoomDetail() {
  for (const k of ['portraitHi', 'liveHi', 'signalHi', 'headline', 'paragraph', 'meta', 'liveCard', 'atlas'] as const) {
    RX[k]?.dispose()
    delete RX[k]
  }
  RX.detailReady = false
  RX.cells = undefined
}
