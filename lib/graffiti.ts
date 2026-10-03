import * as THREE from 'three'
import { rng } from './math'
import { blotches, grain, makeCanvas, toTexture } from './paint'

/* ──────────────────────────────────────────────────────────────────────────
   STREET TYPOGRAPHY — seven distinct families, drawn procedurally onto two atlases.

   01 HAND TAGS     fast marker / spray handwriting (3 personalities)
   02 THROW-UPS     inflated bubble letters, two-tone, imperfect fill
   03 WILDSTYLE     interlocking angular letters with arrows (rare)
   04 BLOCKBUSTERS  architectural block lettering with extrusion
   05 STENCILS      hard-edged, incomplete, over-sprayed
   06 WHEATPASTE    editorial posters on torn paper (cleaner type, printed)
   07 NOTES         small intimate handwriting

   Every piece is also given a *history*: fresh / weathered / nearly erased / painted over / crossed out / half covered.
   Fonts (canvas only, never DOM): see README → "Fonts & licences".
   ────────────────────────────────────────────────────────────────────────── */

type Ctx = CanvasRenderingContext2D
type Rng = ReturnType<typeof rng>

export const FONT = {
  marker: '"Permanent Marker", "Marker Felt", cursive',
  beanie: '"Reenie Beanie", "Bradley Hand", cursive',
  salt: '"Rock Salt", "Bradley Hand", cursive',
  titan: '"Titan One", "Arial Rounded MT Bold", sans-serif',
  bungee: 'Bungee, Impact, sans-serif',
  stencil: '"Saira Stencil One", "Stardos Stencil", Impact, sans-serif',
  pen: '"Nanum Pen Script", "Bradley Hand", cursive',
  serif: '"Playfair Display", Georgia, serif',
  anton: 'Anton, "Arial Narrow", Impact, sans-serif',
  mono: '"Space Mono", ui-monospace, Menlo, monospace',
}
const f = (family: string, px: number, style = '') => `${style} ${Math.round(px)}px ${family}`.trim()

/* ───────────────────────── atlas ───────────────────────── */

export interface Cell {
  id: string
  /** logical size (what the draw function saw) */
  w: number
  h: number
  aspect: number
  /** uv rect: x, y, w, h */
  uv: [number, number, number, number]
}
export interface Spec {
  id: string
  w: number
  h: number
  draw: (ctx: Ctx, w: number, h: number) => void
}

export class Atlas {
  canvas: HTMLCanvasElement
  ctx: Ctx
  cells: Record<string, Cell> = {}
  private x = 2
  private y = 2
  private rowH = 0
  constructor(public W: number, public H: number, public sc: number) {
    const c = makeCanvas(Math.round(W * sc), Math.round(H * sc))
    this.canvas = c.canvas
    this.ctx = c.ctx
  }
  pack(specs: Spec[]) {
    const GUT = 3
    const sorted = [...specs].sort((a, b) => b.h - a.h)
    const PW = this.canvas.width, PH = this.canvas.height
    for (const s of sorted) {
      const pw = Math.ceil(s.w * this.sc), ph = Math.ceil(s.h * this.sc)
      if (this.x + pw + GUT > PW) { this.x = GUT; this.y += this.rowH + GUT; this.rowH = 0 }
      if (this.y + ph + GUT > PH) { console.warn('[graffiti] atlas full, dropped', s.id); continue }
      this.ctx.save()
      this.ctx.translate(this.x, this.y)
      this.ctx.beginPath()
      this.ctx.rect(0, 0, pw, ph)
      this.ctx.clip()
      this.ctx.scale(this.sc, this.sc)
      s.draw(this.ctx, s.w, s.h)
      this.ctx.restore()
      this.cells[s.id] = { id: s.id, w: s.w, h: s.h, aspect: s.w / s.h, uv: [this.x / PW, 1 - (this.y + ph) / PH, pw / PW, ph / PH] }
      this.x += pw + GUT
      this.rowH = Math.max(this.rowH, ph)
    }
    return this
  }
  texture() {
    const t = toTexture(this.canvas, { aniso: 8 })
    return t
  }
}

/* ───────────────────────── shared helpers ───────────────────────── */

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Per-character placement with jitter (baseline, rotation, scale, tracking). Returns total width. */
function run(
  ctx: Ctx, text: string, r: Rng,
  o: { px: number; font: string; tracking?: number; jy?: number; jr?: number; js?: number; slant?: number },
  paint: (ch: string, w: number) => void,
  measureOnly = false,
) {
  ctx.font = o.font
  const tr = (o.tracking ?? 0) * o.px
  const adv: number[] = []
  let total = 0
  for (const ch of text) { const w = ctx.measureText(ch).width; adv.push(w); total += w + tr }
  total -= tr
  if (measureOnly) return total
  let x = -total / 2
  let i = 0
  for (const ch of text) {
    const w = adv[i++]
    ctx.save()
    ctx.translate(x + w / 2, (r() - 0.5) * 2 * (o.jy ?? 0) * o.px)
    ctx.rotate((r() - 0.5) * 2 * (o.jr ?? 0))
    const s = 1 + (r() - 0.5) * 2 * (o.js ?? 0)
    ctx.scale(s, s)
    ctx.transform(1, 0, -(o.slant ?? 0), 1, 0, 0)
    ctx.translate(-w / 2, 0)
    paint(ch, w)
    ctx.restore()
    x += w + tr
  }
  return total
}

function fitPx(ctx: Ctx, text: string, font: (px: number) => string, maxW: number, maxPx: number, tracking = 0) {
  const r = rng(1)
  ctx.save()
  const w100 = run(ctx, text, r, { px: 100, font: font(100), tracking }, () => undefined, true)
  ctx.restore()
  return Math.min(maxPx, (100 * maxW) / Math.max(1, w100))
}

/** largest px (≤ maxPx) at which every line fits maxW in the given font */
function fitLines(ctx: Ctx, lines: string[], font: (px: number) => string, maxW: number, maxPx: number) {
  ctx.save()
  ctx.font = font(100)
  const w100 = Math.max(...lines.map((l) => ctx.measureText(l).width))
  ctx.restore()
  return Math.min(maxPx, (100 * maxW) / Math.max(1, w100))
}

function speckle(ctx: Ctx, r: Rng, x: number, y: number, w: number, h: number, n: number, color: string, rmax = 1.6, a = 0.5) {
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = a * (0.3 + 0.7 * r())
    ctx.beginPath()
    ctx.arc(x + r() * w, y + r() * h, 0.4 + r() * rmax, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drips(ctx: Ctx, r: Rng, xs: [number, number], y: number, color: string, n: number, maxLen: number, wMax = 3.2) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const x = xs[0] + r() * (xs[1] - xs[0])
    const len = maxLen * (0.15 + 0.85 * r() * r())
    const wd = 1 + r() * wMax
    ctx.lineWidth = wd
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (r() - 0.5) * 1.2, y + len)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + (r() - 0.5) * 0.6, y + len, wd * 0.75, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ───────────────────────── history (age, paint-over, cross-out) ───────────────────────── */

export interface Age {
  /** 0..1 overall fade (sun, rain) */
  fade?: number
  /** 0..1 how much is rubbed away in patches */
  erase?: number
  /** fraction of the piece covered by a roller of flat paint (0.3..0.6) */
  paintOver?: number
  /** colour of the cover paint */
  cover?: string
  /** crossed out by another writer */
  cross?: string
  seed: number
}

export function applyAge(ctx: Ctx, w: number, h: number, a: Age) {
  const r = rng(a.seed * 977 + 13)
  ctx.save()
  // 1. erosion: noisy blobs punched out (more at the bottom, where hands and bags reach)
  if (a.erase) {
    ctx.globalCompositeOperation = 'destination-out'
    const n = Math.round(a.erase * 46)
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = h * (0.15 + 0.85 * Math.pow(r(), 0.7)), rad = (6 + r() * 26) * (0.5 + a.erase)
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, `rgba(0,0,0,${0.55 + 0.4 * r()})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.save()
      ctx.translate(x, y); ctx.scale(1 + r() * 1.6, 0.5 + r() * 0.7); ctx.translate(-x, -y)
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      ctx.restore()
    }
    // scratches
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    for (let i = 0; i < n / 3; i++) {
      ctx.lineWidth = 0.6 + r() * 1.4
      ctx.beginPath()
      const x = r() * w, y = r() * h
      ctx.moveTo(x, y)
      ctx.lineTo(x + (r() - 0.5) * 50, y + (r() - 0.5) * 22)
      ctx.stroke()
    }
  }
  // 2. fade
  if (a.fade) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = `rgba(0,0,0,${a.fade})`
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalCompositeOperation = 'source-over'
  // 3. crossed out by someone else
  if (a.cross) {
    ctx.strokeStyle = a.cross
    ctx.lineCap = 'round'
    const hv = r() < 0.5
    ctx.lineWidth = Math.max(5, h * 0.045)
    ctx.globalAlpha = 0.92
    if (hv) {
      for (const d of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(w * (d < 0 ? 0.14 : 0.86), h * 0.14)
        ctx.quadraticCurveTo(w * 0.5, h * (0.5 + (r() - 0.5) * 0.2), w * (d < 0 ? 0.86 : 0.14), h * 0.86)
        ctx.stroke()
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(w * 0.06, h * 0.55)
      for (let i = 1; i <= 9; i++) ctx.lineTo(w * (0.06 + 0.88 * (i / 9)), h * (0.5 + (i % 2 ? -0.16 : 0.16) + (r() - 0.5) * 0.06))
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // drip from the cross-out
    drips(ctx, r, [w * 0.2, w * 0.8], h * 0.72, a.cross, 3, h * 0.18, 2.4)
  }
  // 4. painted over with a roller (30-60 %)
  if (a.paintOver) {
    const cov = a.paintOver
    const side = Math.floor(r() * 4)
    const col = a.cover ?? '#4d443d'
    const edge: [number, number][] = []
    const steps = 28
    // ragged roller edge as a random walk
    let off = 0
    for (let i = 0; i <= steps; i++) { off += (r() - 0.5) * 0.06; edge.push([i / steps, cov + off]) }
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((side * Math.PI) / 2 + (r() - 0.5) * 0.12)
    const W = side % 2 ? h : w, H = side % 2 ? w : h
    ctx.translate(-W / 2, -H / 2)
    ctx.beginPath()
    ctx.moveTo(-6, -6)
    ctx.lineTo(W + 6, -6)
    for (let i = steps; i >= 0; i--) ctx.lineTo(edge[i][0] * W, edge[i][1] * H)
    ctx.closePath()
    ctx.fillStyle = col
    ctx.globalAlpha = 0.97
    ctx.fill()
    // roller texture: faint bands, uneven coverage, brick bleeding through
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-atop'
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'
      ctx.fillRect(r() * W, 0, 3 + r() * 20, H)
    }
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-out'
    speckle(ctx, r, 0, 0, w, h, 90, 'rgba(0,0,0,1)', 1.5, 0.5)
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
}

/* ───────────────────────── 01 HAND TAGS ───────────────────────── */

export interface HandOpts {
  text: string
  face: 'marker' | 'beanie' | 'salt'
  color: string
  outline?: string
  seed: number
  rot?: number
  slant?: number
  tracking?: number
  jitter?: number
  underline?: boolean
  crown?: boolean
  drips?: number
  fill?: number
}
export function drawHand(ctx: Ctx, w: number, h: number, o: HandOpts) {
  const r = rng(o.seed)
  const family = FONT[o.face]
  const px = fitPx(ctx, o.text, (p) => f(family, p), w * 0.82, h * (o.face === 'beanie' ? 0.82 : 0.6), o.tracking ?? 0)
  const slant = o.slant ?? (0.22 + r() * 0.25)
  ctx.save()
  ctx.translate(w / 2, h * 0.64)
  ctx.rotate(o.rot ?? (r() - 0.5) * 0.18)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const lw = px * (o.face === 'beanie' ? 0.045 : 0.03)
  const base = { px, font: f(family, px), tracking: o.tracking ?? 0, jy: (o.jitter ?? 0.05), jr: (o.jitter ?? 0.05) * 1.6, js: 0.06, slant }
  if (o.outline) {
    ctx.strokeStyle = o.outline
    ctx.lineWidth = px * 0.16
    run(ctx, o.text, rng(o.seed + 1), base, (ch) => ctx.strokeText(ch, 0, 0))
  }
  // thin pass first (the marker line), then the body — gives the stroke a slightly uneven edge
  ctx.fillStyle = o.color
  ctx.strokeStyle = o.color
  ctx.lineWidth = lw
  ctx.shadowColor = o.color
  ctx.shadowBlur = o.face === 'marker' ? 2.5 : 1.5
  run(ctx, o.text, rng(o.seed + 1), base, (ch) => { ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0) })
  ctx.shadowBlur = 0
  // underline swoosh / crown
  const width = run(ctx, o.text, rng(2), base, () => undefined, true)
  if (o.underline ?? r() < 0.5) {
    ctx.lineWidth = px * 0.05
    ctx.beginPath()
    ctx.moveTo(-width * 0.5, px * 0.18)
    ctx.bezierCurveTo(-width * 0.2, px * (0.3 + r() * 0.1), width * 0.2, px * 0.05, width * 0.52, px * (0.2 - r() * 0.1))
    ctx.stroke()
  }
  if (o.crown) {
    ctx.lineWidth = px * 0.04
    const x0 = -width * 0.5, y0 = -px * 0.86
    ctx.beginPath()
    ctx.moveTo(x0, y0 + px * 0.2); ctx.lineTo(x0 + px * 0.08, y0); ctx.lineTo(x0 + px * 0.22, y0 + px * 0.14); ctx.lineTo(x0 + px * 0.36, y0 - px * 0.04); ctx.lineTo(x0 + px * 0.46, y0 + px * 0.2)
    ctx.stroke()
  }
  drips(ctx, r, [-width * 0.45, width * 0.45], px * 0.06, o.color, o.drips ?? Math.round(r() * 3), px * 0.55, px * 0.045)
  speckle(ctx, r, -width / 2 - 8, -px, width + 16, px * 1.3, 24, o.color, 1.2, 0.4)
  ctx.restore()
}

/* ───────────────────────── 02 THROW-UP ───────────────────────── */

export interface ThrowOpts { text: string; fill: string; fill2?: string; outline: string; rim?: string; shadow?: string; seed: number; rot?: number }
export function drawThrow(ctx: Ctx, w: number, h: number, o: ThrowOpts) {
  const r = rng(o.seed)
  const px = fitPx(ctx, o.text, (p) => f(FONT.titan, p), w * 0.78, h * 0.62, -0.03)
  ctx.save()
  ctx.translate(w / 2, h * 0.62)
  ctx.rotate(o.rot ?? (r() - 0.5) * 0.14)
  ctx.lineJoin = 'round'
  const base = { px, font: f(FONT.titan, px), tracking: -0.03, jy: 0.025, jr: 0.05, js: 0.03, slant: 0.04 }
  const each = (fn: (ch: string) => void) => run(ctx, o.text, rng(o.seed + 3), base, fn)
  // drop shadow (offset, soft)
  ctx.fillStyle = o.shadow ?? 'rgba(0,0,0,0.55)'
  ctx.strokeStyle = o.shadow ?? 'rgba(0,0,0,0.55)'
  ctx.lineWidth = px * 0.24
  ctx.translate(px * 0.05, px * 0.07)
  each((ch) => { ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0) })
  ctx.translate(-px * 0.05, -px * 0.07)
  // outer + rim outline
  ctx.strokeStyle = o.outline
  ctx.lineWidth = px * 0.23
  each((ch) => ctx.strokeText(ch, 0, 0))
  if (o.rim) {
    ctx.strokeStyle = o.rim
    ctx.lineWidth = px * 0.12
    each((ch) => ctx.strokeText(ch, 0, 0))
  }
  // fill (two-tone: lower third in fill2) with imperfect coverage
  const g = ctx.createLinearGradient(0, -px * 0.75, 0, px * 0.12)
  g.addColorStop(0, o.fill); g.addColorStop(o.fill2 ? 0.58 : 1, o.fill)
  if (o.fill2) { g.addColorStop(0.62, o.fill2); g.addColorStop(1, o.fill2) }
  ctx.fillStyle = g
  ctx.shadowColor = o.fill
  ctx.shadowBlur = 3
  each((ch) => ctx.fillText(ch, 0, 0))
  ctx.shadowBlur = 0
  // shine strokes
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = px * 0.035
  ctx.translate(-px * 0.07, -px * 0.1)
  each((ch) => ctx.strokeText(ch, 0, -px * 0.1))
  ctx.globalCompositeOperation = 'source-over'
  // holes where the can ran dry
  ctx.globalCompositeOperation = 'destination-out'
  speckle(ctx, r, -w * 0.4, -px * 0.8, w * 0.8, px * 0.9, 40, 'rgba(0,0,0,1)', 1.8, 0.65)
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
  const run1 = ctx
  void run1
  ctx.save()
  ctx.translate(w / 2, h * 0.62)
  drips(ctx, r, [-w * 0.3, w * 0.3], px * 0.1, o.outline, 3, px * 0.4, px * 0.05)
  ctx.restore()
}

/* ───────────────────────── 03 WILDSTYLE ───────────────────────── */

export interface WildOpts { text: string; a: string; b: string; outline: string; line: string; seed: number }
export function drawWild(ctx: Ctx, w: number, h: number, o: WildOpts) {
  const r = rng(o.seed)
  const px = fitPx(ctx, o.text, (p) => f(FONT.bungee, p), w * 0.62, h * 0.5, -0.2)
  ctx.save()
  ctx.translate(w / 2, h * 0.58)
  ctx.rotate((r() - 0.5) * 0.12)
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'
  const letters: { x: number; w: number; cx: number; cy: number }[] = []
  const base = { px, font: f(FONT.bungee, px), tracking: -0.2, jy: 0.05, jr: 0.2, js: 0.18, slant: 0.34 }
  const each = (fn: (ch: string) => void) => run(ctx, o.text, rng(o.seed + 5), base, fn)
  // extrude
  ctx.fillStyle = o.line
  ctx.strokeStyle = o.line
  ctx.lineWidth = px * 0.14
  for (let i = 9; i >= 1; i--) {
    ctx.save(); ctx.translate(i * px * 0.018, i * px * 0.026)
    each((ch) => { ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0) })
    ctx.restore()
  }
  // outline, body, inline
  ctx.strokeStyle = o.outline
  ctx.lineWidth = px * 0.17
  each((ch) => ctx.strokeText(ch, 0, 0))
  const g = ctx.createLinearGradient(0, -px * 0.8, 0, px * 0.1)
  g.addColorStop(0, o.a); g.addColorStop(1, o.b)
  ctx.fillStyle = g
  each((ch) => ctx.fillText(ch, 0, 0))
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = o.line
  ctx.lineWidth = px * 0.03
  ctx.translate(px * 0.04, -px * 0.07)
  each((ch) => ctx.strokeText(ch, 0, 0))
  ctx.translate(-px * 0.04, px * 0.07)
  ctx.globalCompositeOperation = 'source-over'
  // measure letter anchors
  const width = run(ctx, o.text, rng(o.seed + 5), base, () => undefined, true)
  const n = o.text.length
  for (let i = 0; i < n; i++) letters.push({ x: 0, w: 0, cx: -width / 2 + (width * (i + 0.5)) / n, cy: -px * 0.35 })
  // arms: angular extensions with arrowheads, spikes, and a few dots
  const arm = (x: number, y: number, ang: number, len: number) => {
    const pts: [number, number][] = [[x, y]]
    let a = ang
    for (let s = 0; s < 3; s++) {
      const l = len * (0.5 + r() * 0.5)
      x += Math.cos(a) * l; y += Math.sin(a) * l
      pts.push([x, y])
      a += (r() < 0.5 ? -1 : 1) * (Math.PI / 4 + r() * Math.PI / 4)
    }
    for (const [lw, col] of [[px * 0.12, o.outline], [px * 0.06, o.line]] as const) {
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.beginPath()
      pts.forEach(([px_, py_], k) => (k ? ctx.lineTo(px_, py_) : ctx.moveTo(px_, py_)))
      ctx.stroke()
    }
    // arrowhead
    const [ex, ey] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2]
    const ta = Math.atan2(ey - by, ex - bx)
    ctx.fillStyle = o.line
    ctx.strokeStyle = o.outline
    ctx.lineWidth = px * 0.035
    ctx.beginPath()
    ctx.moveTo(ex + Math.cos(ta) * px * 0.2, ey + Math.sin(ta) * px * 0.2)
    ctx.lineTo(ex + Math.cos(ta + 2.4) * px * 0.17, ey + Math.sin(ta + 2.4) * px * 0.17)
    ctx.lineTo(ex + Math.cos(ta - 2.4) * px * 0.17, ey + Math.sin(ta - 2.4) * px * 0.17)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
  }
  letters.forEach((l, i) => {
    if (r() < 0.8) arm(l.cx + (r() - 0.5) * px * 0.3, l.cy - px * 0.38, -Math.PI / 2 + (r() - 0.5) * 1.4, px * (0.28 + r() * 0.22))
    if (r() < 0.45) arm(l.cx + (r() - 0.5) * px * 0.3, l.cy + px * 0.3, Math.PI / 2 + (r() - 0.5) * 1.2, px * (0.22 + r() * 0.2))
    if (i === 0 || i === n - 1) arm(l.cx + (i ? px * 0.3 : -px * 0.3), l.cy, i ? 0.2 : Math.PI - 0.2, px * (0.3 + r() * 0.25))
  })
  // crown dots + sparks
  ctx.fillStyle = o.a
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((r() - 0.5) * width, -px * (0.95 + r() * 0.2), px * 0.035, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}

/* ───────────────────────── 04 BLOCKBUSTER ───────────────────────── */

export interface BlockOpts { text: string; face: string; face2: string; outline: string; shade: string; seed: number; depth?: number; rot?: number }
export function drawBlock(ctx: Ctx, w: number, h: number, o: BlockOpts) {
  const r = rng(o.seed)
  const depth = o.depth ?? 12
  const px = fitPx(ctx, o.text, (p) => f(FONT.bungee, p), w * 0.9 - depth * 1.2, h * 0.72, 0.01)
  ctx.save()
  ctx.translate(w / 2 - depth * 0.45, h * 0.58)
  ctx.rotate(o.rot ?? (r() - 0.5) * 0.04)
  ctx.lineJoin = 'miter'
  const base = { px, font: f(FONT.bungee, px), tracking: 0.01, jy: 0.012, jr: 0.01, js: 0.01, slant: 0.0 }
  const each = (fn: (ch: string) => void) => run(ctx, o.text, rng(o.seed + 9), base, fn)
  // extrusion
  for (let i = depth; i >= 1; i--) {
    ctx.save(); ctx.translate(i * 0.9, i * 0.9)
    ctx.fillStyle = o.shade
    ctx.strokeStyle = o.shade
    ctx.lineWidth = px * 0.05
    each((ch) => { ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0) })
    ctx.restore()
  }
  // dark contour around face+extrusion
  ctx.strokeStyle = o.outline
  ctx.lineWidth = px * 0.09
  for (const t of [0, depth]) { ctx.save(); ctx.translate(t * 0.9, t * 0.9); each((ch) => ctx.strokeText(ch, 0, 0)); ctx.restore() }
  const g = ctx.createLinearGradient(0, -px * 0.75, 0, px * 0.1)
  g.addColorStop(0, o.face); g.addColorStop(0.55, o.face); g.addColorStop(0.56, o.face2); g.addColorStop(1, o.face2)
  ctx.fillStyle = g
  ctx.shadowColor = o.face
  ctx.shadowBlur = 2
  each((ch) => ctx.fillText(ch, 0, 0))
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = px * 0.022
  ctx.translate(-px * 0.02, -px * 0.03)
  each((ch) => ctx.strokeText(ch, 0, 0))
  // sun / spray falloff toward the bottom
  ctx.globalCompositeOperation = 'destination-out'
  speckle(ctx, r, -w / 2, -px * 0.8, w, px * 1.1, 160, 'rgba(0,0,0,1)', 2.2, 0.55)
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

/* ───────────────────────── 05 STENCIL ───────────────────────── */

export interface StencilOpts { text: string; color: string; seed: number; font?: 'stencil' | 'bungee'; sub?: string; rot?: number; holes?: number }
export function drawStencil(ctx: Ctx, w: number, h: number, o: StencilOpts) {
  const r = rng(o.seed)
  const fam = o.font === 'bungee' ? FONT.bungee : FONT.stencil
  const sub = o.sub ? h * 0.18 : 0
  const px = fitPx(ctx, o.text, (p) => f(fam, p), w * 0.86, (h - sub) * 0.78)
  ctx.save()
  ctx.translate(w / 2, (h - sub) * 0.62)
  ctx.rotate(o.rot ?? (r() - 0.5) * 0.05)
  ctx.font = f(fam, px)
  ctx.textAlign = 'center'
  // leakage: the stencil lifted a little, so a soft halo
  ctx.fillStyle = rgba(o.color, 0.22)
  ctx.shadowColor = rgba(o.color, 0.5)
  ctx.shadowBlur = Math.max(1.5, px * 0.025)
  ctx.fillText(o.text, px * 0.008, px * 0.006)
  ctx.shadowBlur = 0
  ctx.fillStyle = o.color
  ctx.fillText(o.text, 0, 0)
  // incomplete paint: voids and a missing band
  ctx.globalCompositeOperation = 'destination-out'
  const holes = o.holes ?? 40
  speckle(ctx, r, -w / 2, -px, w, px * 1.3, Math.round(holes * 0.6), 'rgba(0,0,0,1)', 1.3, 0.9)
  for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + r() * w, -px * 0.9 + r() * px, 6 + r() * 20, 1 + r() * 1.6)
  ctx.globalCompositeOperation = 'source-over'
  // runs
  drips(ctx, r, [-w * 0.35, w * 0.35], px * 0.0, o.color, 2, px * 0.22, px * 0.03)
  ctx.restore()
  if (o.sub) {
    ctx.save()
    ctx.fillStyle = o.color
    ctx.font = f(FONT.stencil, h * 0.12)
    ctx.textAlign = 'center'
    ctx.globalAlpha = 0.9
    ctx.fillText(o.sub, w / 2, h - 6)
    ctx.restore()
  }
  speckle(ctx, r, 0, 0, w, h, 36, o.color, 0.9, 0.3)
}

export function drawSymbol(ctx: Ctx, w: number, h: number, kind: 'crosshair' | 'hourglass' | 'arrow' | 'barcode' | 'hd' | 'eye', color: string, seed: number) {
  const r = rng(seed)
  const s = Math.min(w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * 0.05
  ctx.lineCap = 'butt'
  ctx.shadowColor = rgba(color, 0.7)
  ctx.shadowBlur = s * 0.03
  if (kind === 'crosshair') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2); ctx.stroke()
    for (const a of [0, 1, 2, 3]) { ctx.save(); ctx.rotate((a * Math.PI) / 2); ctx.fillRect(-s * 0.025, -s * 0.44, s * 0.05, s * 0.3); ctx.restore() }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, Math.PI * 2); ctx.fill()
  } else if (kind === 'hourglass') {
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.38); ctx.lineTo(s * 0.3, -s * 0.38); ctx.lineTo(-s * 0.3, s * 0.38); ctx.lineTo(s * 0.3, s * 0.38); ctx.closePath(); ctx.stroke()
    ctx.fillRect(-s * 0.36, -s * 0.44, s * 0.72, s * 0.05); ctx.fillRect(-s * 0.36, s * 0.39, s * 0.72, s * 0.05)
  } else if (kind === 'arrow') {
    ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(s * 0.3, -s * 0.05); ctx.lineTo(s * 0.12, -s * 0.05); ctx.lineTo(s * 0.12, s * 0.42); ctx.lineTo(-s * 0.12, s * 0.42); ctx.lineTo(-s * 0.12, -s * 0.05); ctx.lineTo(-s * 0.3, -s * 0.05); ctx.closePath(); ctx.fill()
  } else if (kind === 'barcode') {
    let x = -s * 0.4
    while (x < s * 0.4) { const bw = s * (0.012 + r() * 0.04); ctx.fillRect(x, -s * 0.3, bw, s * 0.6); x += bw + s * (0.014 + r() * 0.03) }
  } else if (kind === 'eye') {
    ctx.beginPath(); ctx.moveTo(-s * 0.42, 0); ctx.quadraticCurveTo(0, -s * 0.34, s * 0.42, 0); ctx.quadraticCurveTo(0, s * 0.34, -s * 0.42, 0); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.font = f(FONT.stencil, s * 0.62); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HD', 0, 0)
    ctx.strokeRect(-s * 0.42, -s * 0.3, s * 0.84, s * 0.6)
  }
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = 'destination-out'
  speckle(ctx, r, -s / 2, -s / 2, s, s, 30, 'rgba(0,0,0,1)', 2, 0.9)
  ctx.restore()
}

/* ───────────────────────── 06 WHEATPASTE ───────────────────────── */

export interface PaperOpts { bg: string; seed: number; torn?: number; fade?: number; creases?: number; yellow?: number; cornerTear?: boolean }
/** Draws `content` clipped to an irregular torn sheet, then ages it. */
export function paper(ctx: Ctx, w: number, h: number, o: PaperOpts, content: () => void) {
  const r = rng(o.seed)
  const jag = (o.torn ?? 1) * 7
  ctx.save()
  const m = 4 + jag
  ctx.beginPath()
  const pts: [number, number][] = []
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * jag, y0 + (y1 - y0) * t + (r() - 0.5) * jag]) }
  }
  edge(m, m, w - m, m, 22); edge(w - m, m, w - m, h - m, 30); edge(w - m, h - m, m, h - m, 22); edge(m, h - m, m, m, 30)
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.clip()
  // sheet
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, o.bg); g.addColorStop(1, o.bg)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  content()
  // wrinkles: pairs of light/dark lines
  for (let i = 0; i < (o.creases ?? 9); i++) {
    const x0 = r() * w, y0 = r() * h, x1 = x0 + (r() - 0.5) * w * 0.9, y1 = y0 + (r() - 0.5) * h * 0.9
    ctx.lineWidth = 1 + r() * 2.2
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.16})`
    ctx.beginPath(); ctx.moveTo(x0 + 1.5, y0 + 1.5); ctx.lineTo(x1 + 1.5, y1 + 1.5); ctx.stroke()
  }
  // sun-bleach + yellowing + stains
  ctx.fillStyle = `rgba(255,248,225,${o.fade ?? 0.1})`
  ctx.fillRect(0, 0, w, h)
  const gy = ctx.createLinearGradient(0, 0, 0, h)
  gy.addColorStop(0, `rgba(120,95,50,${(o.yellow ?? 0.1) * 0.4})`); gy.addColorStop(1, `rgba(90,70,40,${o.yellow ?? 0.1})`)
  ctx.fillStyle = gy
  ctx.fillRect(0, 0, w, h)
  blotches(ctx, w, h, 8, o.seed + 4, [60, 45, 30], 0.04, 0.16, 18, 70)
  // glue sheen along the borders
  ctx.strokeStyle = 'rgba(255,245,220,0.22)'
  ctx.lineWidth = 5
  ctx.stroke()
  grain(ctx, w, h, 14, o.seed + 6)
  ctx.restore()
  if (o.cornerTear ?? r() < 0.5) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    const cx = r() < 0.5 ? 0 : w, cy = r() < 0.5 ? 0 : h
    const s = 22 + r() * 36
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    const sx = cx === 0 ? 1 : -1, sy = cy === 0 ? 1 : -1
    for (let i = 0; i <= 8; i++) ctx.lineTo(cx + sx * s * (1 - i / 8) + (r() - 0.5) * 5, cy + sy * s * (i / 8) + (r() - 0.5) * 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

/** a scrap of other paper laid over (partly covers whatever is below) */
export function scrap(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, seed: number, inkLines = 0) {
  const r = rng(seed)
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate((r() - 0.5) * 0.14)
  ctx.translate(-w / 2, -h / 2)
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 2
  ctx.beginPath()
  const j = 5
  ctx.moveTo(0, 0)
  for (let i = 1; i <= 10; i++) ctx.lineTo((w * i) / 10, (r() - 0.5) * j)
  for (let i = 1; i <= 10; i++) ctx.lineTo(w + (r() - 0.5) * j, (h * i) / 10)
  for (let i = 1; i <= 10; i++) ctx.lineTo(w - (w * i) / 10, h + (r() - 0.5) * j)
  for (let i = 1; i <= 10; i++) ctx.lineTo((r() - 0.5) * j, h - (h * i) / 10)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.clip()
  for (let i = 0; i < inkLines; i++) {
    ctx.fillStyle = 'rgba(20,20,20,0.5)'
    ctx.fillRect(w * 0.08, h * (0.15 + (0.7 * i) / Math.max(1, inkLines)), w * (0.3 + r() * 0.55), 3 + r() * 5)
  }
  grain(ctx, w, h, 10, seed + 2)
  ctx.restore()
}

export interface PosterOpts {
  variant: 0 | 1 | 2 | 3
  n: number
  title: string[]
  seed: number
  list?: string[]
  /** how much of the poster is covered by later layers (0..0.5) */
  covered?: number
}
const TRACK_PAL = [
  { bg: '#d9d1bf', ink: '#14120f', acc: '#b8322a' },
  { bg: '#16161a', ink: '#ece5d4', acc: '#e0b840' },
  { bg: '#c8362a', ink: '#14100e', acc: '#f2e8d0' },
  { bg: '#e6e0cf', ink: '#14161c', acc: '#2a5ac8' },
]
export function drawTrackPoster(ctx: Ctx, w: number, h: number, o: PosterOpts) {
  const p = TRACK_PAL[(o.variant + o.n) % TRACK_PAL.length]
  const r = rng(o.seed)
  const num = String(o.n).padStart(2, '0')
  paper(ctx, w, h, { bg: p.bg, seed: o.seed, torn: 1 + r() * 0.8, fade: 0.05 + r() * 0.14, yellow: 0.05 + r() * 0.14, creases: 6 + Math.round(r() * 6) }, () => {
    ctx.textBaseline = 'alphabetic'
    if (o.variant === 0) {
      // editorial serif
      ctx.fillStyle = p.acc
      ctx.font = f(FONT.mono, w * 0.04, 'bold')
      ctx.fillText(`ALTERCO — TRACCIA ${num}`, w * 0.07, h * 0.075)
      ctx.fillStyle = p.ink
      let y = h * 0.62
      const px = fitLines(ctx, o.title, (p) => f(FONT.serif, p, 'italic 900'), w * 0.86, w * 0.19)
      for (const line of o.title) { ctx.font = f(FONT.serif, px, 'italic 900'); ctx.fillText(line, w * 0.07, y); y += px * 0.98 }
      ctx.font = f(FONT.bungee, w * 0.5)
      ctx.strokeStyle = rgba(p.ink, 0.22)
      ctx.lineWidth = 2
      ctx.strokeText(num, w * 0.04, h * 0.5)
      ctx.fillStyle = p.ink
      ctx.fillRect(w * 0.07, h * 0.9, w * 0.86, 2)
      ctx.font = f(FONT.mono, w * 0.035)
      ctx.fillText('HOODDINO', w * 0.07, h * 0.945)
    } else if (o.variant === 1) {
      // condensed grotesk, stacked
      ctx.fillStyle = p.acc
      ctx.font = f(FONT.anton, w * 0.5)
      ctx.fillText(num, w * 0.05, h * 0.42)
      ctx.fillStyle = p.ink
      let y = h * 0.62
      const px = fitLines(ctx, o.title, (p) => f(FONT.anton, p), w * 0.88, w * 0.22)
      for (const line of o.title) { ctx.font = f(FONT.anton, px); ctx.fillText(line, w * 0.06, y); y += px * 1.02 }
      ctx.font = f(FONT.mono, w * 0.036)
      ctx.fillStyle = p.acc
      ctx.fillText('HOODDINO — ALTERCO', w * 0.06, h * 0.95)
    } else if (o.variant === 2) {
      // type grid / tracklist
      ctx.fillStyle = p.ink
      ctx.font = f(FONT.bungee, w * 0.62)
      ctx.globalAlpha = 0.9
      ctx.fillText(num, -w * 0.02, h * 0.54)
      ctx.globalAlpha = 1
      ctx.font = f(FONT.mono, w * 0.036, 'bold')
      const lines = o.list ?? []
      lines.forEach((l, i) => { ctx.fillStyle = l.startsWith(num) ? p.acc : p.ink; ctx.globalAlpha = l.startsWith(num) ? 1 : 0.5; ctx.fillText(l, w * 0.07, h * (0.66 + i * 0.043)) })
      ctx.globalAlpha = 1
      ctx.fillStyle = p.ink
      ctx.font = f(FONT.anton, w * 0.12)
      ctx.fillText(o.title.join(' '), w * 0.07, h * 0.1)
    } else {
      // xerox: misregistered double print
      for (const [dx, col] of [[3, rgba(p.acc, 0.8)], [0, p.ink]] as const) {
        ctx.fillStyle = col
        let y = h * 0.28
        const px = fitLines(ctx, o.title, (p) => f(FONT.stencil, p), w * 0.84, w * 0.2)
        for (const line of o.title) { ctx.font = f(FONT.stencil, px); ctx.fillText(line, w * 0.08 + dx, y + dx); y += px * 1.04 }
        ctx.font = f(FONT.stencil, w * 0.4)
        ctx.fillText(num, w * 0.08 + dx, h * 0.86 + dx)
      }
      // halftone fade
      ctx.fillStyle = rgba(p.ink, 0.6)
      for (let yy = h * 0.55; yy < h * 0.8; yy += 8) for (let xx = (yy / 8) % 2 ? 4 : 0; xx < w; xx += 8) { ctx.beginPath(); ctx.arc(xx, yy, 0.6 + 1.8 * (1 - (yy - h * 0.55) / (h * 0.25)), 0, Math.PI * 2); ctx.fill() }
    }
    // later layers: scraps of other posters stuck on top
    const cov = o.covered ?? 0
    if (cov > 0) {
      const sw = w * (0.45 + cov * 0.6), sh = h * (0.18 + cov * 0.4)
      scrap(ctx, w * (0.35 + r() * 0.4) - sw / 2, h * (0.55 + r() * 0.35) - sh / 2, sw, sh, r() < 0.5 ? '#d9d1bf' : '#1c1c1f', o.seed + 11, 3)
    }
  })
}

export function drawBigPoster(ctx: Ctx, w: number, h: number, o: { lines: string[]; sub: string; seed: number; pal: number; halftone?: boolean }) {
  const p = TRACK_PAL[o.pal % TRACK_PAL.length]
  const r = rng(o.seed)
  paper(ctx, w, h, { bg: p.bg, seed: o.seed, fade: 0.1, yellow: 0.1 }, () => {
    if (o.halftone) {
      ctx.fillStyle = p.acc
      for (let y = 0; y < h * 0.45; y += 11) for (let x = (y / 11) % 2 ? 5.5 : 0; x < w; x += 11) { ctx.beginPath(); ctx.arc(x, y + 14, 1 + 4.8 * (1 - y / (h * 0.45)), 0, Math.PI * 2); ctx.fill() }
    }
    ctx.fillStyle = p.ink
    let y = h * 0.38
    const px = Math.min(w * 0.4, (w * 0.86) / Math.max(...o.lines.map((t) => t.length * 0.52)))
    o.lines.forEach((ln, i) => { ctx.font = f(FONT.anton, px); ctx.fillStyle = i % 2 ? p.acc : p.ink; ctx.fillText(ln, w * 0.07, y); y += px * 1.02 })
    ctx.fillStyle = p.ink
    ctx.font = f(FONT.mono, w * 0.04, 'bold')
    ctx.fillText(o.sub, w * 0.07, h * 0.94)
  })
  void r
}

export function drawSticker(ctx: Ctx, w: number, h: number, o: { kind: 'num' | 'hd' | 'alt' | 'eye' | 'seven'; text?: string; seed: number; bg: string; fg: string }) {
  const r = rng(o.seed)
  const s = Math.min(w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((r() - 0.5) * 0.3)
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1
  ctx.fillStyle = o.bg
  if (o.kind === 'eye') { ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill() } else { ctx.beginPath(); ctx.roundRect(-s * 0.46, -s * 0.34, s * 0.92, s * 0.68, s * 0.06); ctx.fill() }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.fillStyle = o.fg
  ctx.strokeStyle = o.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (o.kind === 'num') { ctx.font = f(FONT.bungee, s * 0.5); ctx.fillText(o.text ?? '02', 0, s * 0.02) }
  else if (o.kind === 'hd') { ctx.font = f(FONT.anton, s * 0.5); ctx.fillText('HD', 0, s * 0.02) }
  else if (o.kind === 'alt') { ctx.font = f(FONT.mono, s * 0.2, 'bold'); ctx.fillText('ALTERCO', 0, -s * 0.05); ctx.font = f(FONT.mono, s * 0.1); ctx.fillText('7 TRACCE', 0, s * 0.14) }
  else if (o.kind === 'seven') { ctx.font = f(FONT.titan, s * 0.55); ctx.fillText('7', 0, s * 0.03) }
  else { ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.quadraticCurveTo(0, -s * 0.24, s * 0.3, 0); ctx.quadraticCurveTo(0, s * 0.24, -s * 0.3, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.07, 0, Math.PI * 2); ctx.fill() }
  // peeling corner + scuffs
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath(); ctx.moveTo(s * 0.46, s * 0.1); ctx.lineTo(s * 0.46, s * 0.34); ctx.lineTo(s * 0.22, s * 0.34); ctx.closePath(); ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  speckle(ctx, r, -s / 2, -s / 2, s, s, 22, 'rgba(0,0,0,1)', 1.6, 0.8)
  ctx.restore()
}

/* ───────────────────────── 07 NOTES ───────────────────────── */

export function drawNote(ctx: Ctx, w: number, h: number, o: { text: string; face: 'pen' | 'beanie'; color: string; seed: number; circle?: boolean; arrow?: boolean; strike?: boolean }) {
  const r = rng(o.seed)
  const fam = o.face === 'pen' ? FONT.pen : FONT.beanie
  const px = fitPx(ctx, o.text, (p) => f(fam, p), w * 0.84, h * 0.7)
  ctx.save()
  ctx.translate(w / 2, h * 0.64)
  ctx.rotate((r() - 0.5) * 0.12)
  ctx.fillStyle = o.color
  ctx.strokeStyle = o.color
  ctx.lineWidth = px * 0.035
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.font = f(fam, px)
  ctx.textAlign = 'center'
  ctx.strokeText(o.text, 0, 0)
  ctx.fillText(o.text, 0, 0)
  const tw = ctx.measureText(o.text).width
  if (o.circle) {
    ctx.lineWidth = px * 0.05
    ctx.beginPath(); ctx.ellipse(0, -px * 0.25, tw * 0.58, px * 0.55, (r() - 0.5) * 0.08, 0.2, Math.PI * 2 + 0.55); ctx.stroke()
  }
  if (o.arrow) {
    ctx.lineWidth = px * 0.06
    ctx.beginPath(); ctx.moveTo(tw * 0.55, -px * 0.2); ctx.quadraticCurveTo(tw * 0.72, -px * 0.5, tw * 0.84, -px * 0.1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(tw * 0.84, -px * 0.1); ctx.lineTo(tw * 0.78, -px * 0.3); ctx.moveTo(tw * 0.84, -px * 0.1); ctx.lineTo(tw * 0.68, -px * 0.12); ctx.stroke()
  }
  if (o.strike) { ctx.lineWidth = px * 0.05; ctx.beginPath(); ctx.moveTo(-tw * 0.5, -px * 0.22); ctx.lineTo(tw * 0.5, -px * 0.3); ctx.stroke() }
  ctx.restore()
}

/** fluorescent paint that only shows under the night sky */
export function drawUV(ctx: Ctx, w: number, h: number, seed: number) {
  const r = rng(seed)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.strokeStyle = '#9fd0ff'
  ctx.fillStyle = '#9fd0ff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = '#5aa8ff'
  ctx.shadowBlur = 8
  ctx.lineWidth = h * 0.06
  // a looping scrawl that resolves into the hourglass sign
  ctx.beginPath()
  ctx.moveTo(-w * 0.38, -h * 0.25)
  ctx.bezierCurveTo(-w * 0.1, -h * 0.45, w * 0.1, -h * 0.05, -w * 0.2, h * 0.25)
  ctx.bezierCurveTo(-w * 0.35, h * 0.4, w * 0.2, h * 0.4, w * 0.1, h * 0.05)
  ctx.bezierCurveTo(w * 0.05, -h * 0.2, w * 0.35, -h * 0.3, w * 0.4, h * 0.2)
  ctx.stroke()
  ctx.lineWidth = h * 0.035
  ctx.beginPath(); ctx.moveTo(w * 0.2, -h * 0.4); ctx.lineTo(w * 0.42, -h * 0.4); ctx.lineTo(w * 0.2, -h * 0.05); ctx.lineTo(w * 0.42, -h * 0.05); ctx.closePath(); ctx.stroke()
  speckle(ctx, r, -w / 2, -h / 2, w, h, 40, '#9fd0ff', 1.4, 0.7)
  ctx.restore()
}

/** A tiny sign that belongs to the other place: two halves of a ring that do not quite meet. Drawn in UV paint. */
export function drawGlyph(ctx: Ctx, w: number, h: number) {
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.strokeStyle = '#a8d4ff'
  ctx.lineCap = 'round'
  ctx.shadowColor = '#5aa8ff'
  ctx.shadowBlur = 5
  ctx.lineWidth = w * 0.07
  const R = w * 0.3
  ctx.beginPath(); ctx.arc(-w * 0.03, 0, R, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke()
  ctx.beginPath(); ctx.arc(w * 0.05, 0, R, -Math.PI * 0.38, Math.PI * 0.38); ctx.stroke()
  ctx.lineWidth = w * 0.045
  ctx.beginPath(); ctx.moveTo(w * 0.01, -R * 1.25); ctx.lineTo(-w * 0.01, R * 1.25); ctx.stroke()
  ctx.restore()
}

/** The anamorphic ALTERCO mask: letters laid along an arc in *view space* (see AnamorphicWord). */
export function anamorphMask(): HTMLCanvasElement {
  const W = 1536, H = 768
  const { canvas, ctx } = makeCanvas(W, H)
  const r = rng(404)
  ctx.clearRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const word = 'ALTERCO'
  // arc: left letters on the left wall (at horizon height), the centre letter low on the ground, right letters on the right wall
  const spots: [number, number, number][] = [
    [0.1, 0.5, -0.1], [0.215, 0.44, -0.06], [0.34, 0.52, -0.02], [0.5, 0.7, 0], [0.66, 0.52, 0.02], [0.785, 0.44, 0.06], [0.9, 0.5, 0.1],
  ]
  word.split('').forEach((ch, i) => {
    const [ux, uy, rot] = spots[i]
    ctx.save()
    ctx.translate(ux * W, uy * H)
    ctx.rotate(rot)
    ctx.font = f(FONT.stencil, 190)
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(255,255,255,0.8)'
    ctx.shadowBlur = 10
    ctx.fillText(ch, 0, 0)
    ctx.shadowBlur = 0
    ctx.globalCompositeOperation = 'destination-out'
    speckle(ctx, r, -90, -110, 180, 220, 70, 'rgba(0,0,0,1)', 2.2, 0.8)
    ctx.restore()
  })
  return canvas
}
