import * as THREE from 'three'
import { rng } from './math'
import {
  DISPLAY_FONT, MONO_FONT, blotches, fitText, grain, makeCanvas, noiseField, rgb, roundRect, tornPath, toTexture,
} from './paint'

/* ──────────────────────────────────────────────────────────────────────────
   All environment surfaces are generated procedurally (canvas) — no reference
   photography is copied. Official artwork is only ever loaded from /covers.
   ────────────────────────────────────────────────────────────────────────── */

type RGB = [number, number, number]

export interface BrickSet {
  map: THREE.Texture
  bump: THREE.Texture
}

/** Tile = 2.4 m wide (11 bricks), 2.4 m tall (32 courses). */
export function brickSet(variant: 'red' | 'dark' | 'weathered' | 'plaster' | 'concrete', seed: number): BrickSet {
  const W = 1024, H = 1024
  const rows = 32, per = 11
  const bw = W / per, bh = H / rows
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(W, H)
  const bump = makeCanvas(W, H)
  const base: Record<string, RGB> = {
    red: [128, 62, 46], dark: [96, 68, 60], weathered: [118, 86, 66], plaster: [128, 62, 46], concrete: [86, 86, 84],
  }
  const b0 = base[variant]
  const mortar = variant === 'dark' ? '#2a2623' : variant === 'weathered' ? '#7a756c' : '#59544d'
  ctx.fillStyle = mortar
  ctx.fillRect(0, 0, W, H)
  bump.ctx.fillStyle = '#000'
  bump.ctx.fillRect(0, 0, W, H)

  if (variant !== 'concrete') {
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? bw / 2 : 0
      for (let c = 0; c <= per; c++) {
        const x = c * bw + off
        const y = row * bh
        const v = r.range(-0.22, 0.2)
        const burnt = r() < 0.07 ? r.range(0.45, 0.7) : 1
        const tint = r.range(-8, 8)
        const col = rgb(b0[0] * (1 + v) * burnt + tint, b0[1] * (1 + v * 0.9) * burnt, b0[2] * (1 + v * 0.8) * burnt - tint * 0.5)
        for (const dx of [0, -W]) {
          const gx = x + dx + 2, gy = y + 2, gw = bw - 4, gh = bh - 4
          ctx.fillStyle = col
          roundRect(ctx, gx, gy, gw, gh, 2.5)
          ctx.fill()
          // lit top edge / dark bottom edge
          ctx.fillStyle = 'rgba(255,230,200,0.10)'
          ctx.fillRect(gx + 1, gy, gw - 2, 2)
          ctx.fillStyle = 'rgba(0,0,0,0.18)'
          ctx.fillRect(gx + 1, gy + gh - 2, gw - 2, 2)
          bump.ctx.fillStyle = `rgb(${150 + r() * 90},${150 + r() * 90},${150 + r() * 90})`
          roundRect(bump.ctx, gx, gy, gw, gh, 2.5)
          bump.ctx.fill()
        }
      }
    }
  } else {
    // poured concrete panels with seams
    ctx.fillStyle = rgb(...b0)
    ctx.fillRect(0, 0, W, H)
    bump.ctx.fillStyle = '#9a9a9a'
    bump.ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    for (const y of [0, H / 2]) ctx.fillRect(0, y, W, 3)
    for (const x of [0, W / 2]) ctx.fillRect(x, 0, 3, H)
  }

  if (variant === 'plaster') {
    // peeling stucco over brick
    const p = makeCanvas(W, H)
    p.ctx.fillStyle = r() < 0.5 ? '#8c8478' : '#7c8078'
    p.ctx.fillRect(0, 0, W, H)
    blotches(p.ctx, W, H, 40, seed + 3, [60, 55, 48], 0.1, 0.3, 40, 160)
    grain(p.ctx, W, H, 26, seed + 4)
    p.ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 5; i++) {
      const cx = r() * W, cy = r() * H
      p.ctx.beginPath()
      const n = 18
      const rad = r.range(90, 200)
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2
        const rr = rad * (0.6 + r() * 0.6)
        const px = cx + Math.cos(a) * rr * 1.3, py = cy + Math.sin(a) * rr
        k ? p.ctx.lineTo(px, py) : p.ctx.moveTo(px, py)
      }
      p.ctx.closePath()
      p.ctx.fillStyle = '#000'
      p.ctx.fill()
      // wrap-around copies so the tile stays seamless
      if (cx < 250) { p.ctx.save(); p.ctx.translate(W, 0); p.ctx.fill(); p.ctx.restore() }
    }
    ctx.drawImage(p.canvas, 0, 0)
    bump.ctx.globalAlpha = 0.5
    bump.ctx.fillStyle = '#b0b0b0'
    bump.ctx.fillRect(0, 0, W, H)
    bump.ctx.globalAlpha = 1
  }

  // grime + pixel grain
  blotches(ctx, W, H, 60, seed + 7, [20, 16, 14], 0.06, 0.2, 30, 140)
  blotches(ctx, W, H, 18, seed + 8, [200, 190, 170], 0.03, 0.08, 40, 110)
  grain(ctx, W, H, 22, seed + 9)
  return {
    map: toTexture(canvas, { wrap: true, aniso: 8 }),
    bump: toTexture(bump.canvas, { wrap: true, srgb: false, aniso: 4 }),
  }
}

export function asphaltTexture(seed = 11) {
  const W = 1024, H = 1024
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#2a2a2d'
  ctx.fillRect(0, 0, W, H)
  const f = noiseField(256, 256, 1.4, 4, seed)
  const img = ctx.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (f[(y >> 2) * 256 + (x >> 2)] - 0.5) * 34
    const i = (y * W + x) * 4
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v + 2
  }
  ctx.putImageData(img, 0, 0)
  // aggregate
  for (let i = 0; i < 38000; i++) {
    const l = r() < 0.5
    ctx.fillStyle = l ? `rgba(120,118,120,${r.range(0.1, 0.35)})` : `rgba(8,8,10,${r.range(0.2, 0.5)})`
    const s = r.range(0.6, 2.2)
    ctx.fillRect(r() * W, r() * H, s, s)
  }
  // patches
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(${r.range(14, 36)},${r.range(14, 36)},${r.range(16, 40)},0.35)`
    const x = r() * W, y = r() * H, w = r.range(120, 340), h = r.range(100, 260)
    ctx.fillRect(x, y, w, h)
  }
  // cracks
  ctx.strokeStyle = 'rgba(5,5,6,0.65)'
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = r.range(0.8, 2)
    ctx.beginPath()
    let x = r() * W, y = r() * H
    ctx.moveTo(x, y)
    for (let k = 0; k < 24; k++) { x += r.range(-26, 26) + 8; y += r.range(6, 28); ctx.lineTo(x, y) }
    ctx.stroke()
  }
  blotches(ctx, W, H, 24, seed + 2, [5, 5, 8], 0.12, 0.3, 40, 150)
  grain(ctx, W, H, 12, seed + 3)
  return toTexture(canvas, { wrap: true, aniso: 8 })
}

export function sidewalkTexture(seed = 5) {
  const W = 512, H = 512
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#4a4946'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 30, seed, [20, 20, 22], 0.1, 0.3, 30, 120)
  blotches(ctx, W, H, 10, seed + 1, [160, 150, 140], 0.04, 0.1, 40, 110)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, W, H)
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(0,0,0,${r.range(0.1, 0.4)})`; ctx.fillRect(r() * W, r() * H, 1.5, 1.5) }
  grain(ctx, W, H, 14, seed + 4)
  return toTexture(canvas, { wrap: true })
}

/**
 * World-aligned wetness FIELD (not a hard mask). x ∈ [-halfW, halfW], z ∈ [zNear, zFar] mapped to the canvas.
 *  R = puddle depth field (thresholded in the shader; the threshold falls along the journey so puddles grow)
 *  G = damp film (asphalt that is wet but holds no standing water)
 *  B = oil / contamination noise (thin-film tint inside puddles)
 * The large pool lives in front of the track orbit (the portal).
 */
export function puddleMask(opts: { halfW: number; zNear: number; zFar: number; pool: { x: number; z: number; r: number }; layout?: 'street' | 'roof' }) {
  const W = 512, H = opts.layout === 'roof' ? 724 : 2048
  const r = rng(77)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const px = (x: number) => ((x + opts.halfW) / (opts.halfW * 2)) * W
  const pz = (z: number) => ((opts.zNear - z) / (opts.zNear - opts.zFar)) * H
  const ppm = W / (opts.halfW * 2)
  const ppz = H / (opts.zNear - opts.zFar)
  ctx.globalCompositeOperation = 'lighten'
  const blob = (x: number, z: number, rx: number, rz: number, a: number) => {
    const cx = px(x), cz = pz(z)
    const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, 1)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.78})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.save()
    ctx.translate(cx, cz)
    ctx.scale(rx * ppm, rz * ppz)
    ctx.translate(-cx, -cz)
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cz, 1, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  if (opts.layout === 'roof') {
    // rain-pooled roof: broad shallow lakes between the vents, a few long ones along the drainage falls, many small ponds
    const rr = rng(131)
    blob(opts.pool.x, opts.pool.z, opts.pool.r, opts.pool.r * 0.8, 1)
    for (let i = 0; i < 9; i++) blob(rr.range(-opts.halfW * 0.8, opts.halfW * 0.8), rr.range(opts.zNear - 3, opts.zFar + 3), rr.range(1.0, 3.2), rr.range(0.9, 2.6), rr.range(0.55, 0.95))
    for (let i = 0; i < 14; i++) blob(rr.range(-opts.halfW * 0.9, opts.halfW * 0.9), rr.range(opts.zNear - 1, opts.zFar + 1), rr.range(0.3, 0.9), rr.range(0.3, 0.9), rr.range(0.5, 0.85))
  } else {
    // alley runs: elongated puddles along the centre line (late ones are shallower → only appear as the water grows)
    for (let z = 14; z > -70; z -= r.range(6, 13)) {
      const x = r.range(-1.5, 1.5)
      const n = r.int(1, 3)
      for (let k = 0; k < n; k++) blob(x + r.range(-0.4, 0.4), z + r.range(-0.8, 0.8), r.range(0.3, 1.0), r.range(0.6, 2.0), r.range(0.5, 0.95))
    }
    // gutters near the kerbs, tyre-rut lines
    for (let z = 14; z > -70; z -= r.range(7, 14)) blob(r.sign() * r.range(2.3, 2.7), z, r.range(0.12, 0.3), r.range(1.2, 3), 0.62)
    for (let z = 16; z > -74; z -= r.range(10, 18)) { blob(-0.9, z, 0.16, r.range(2.5, 5), 0.58); blob(0.95, z + 1, 0.16, r.range(2.5, 5), 0.56) }
    // plaza: scattered pools
    for (let i = 0; i < 12; i++) blob(r.range(-9, 9), r.range(-76, -112), r.range(0.5, 1.7), r.range(0.5, 1.5), r.range(0.45, 0.9))
    // the "wrong" puddle (hovering it distorts reality) — guaranteed to exist
    blob(0.2, -41, 0.95, 1.9, 1)
    blob(opts.pool.x, opts.pool.z, opts.pool.r, opts.pool.r * 0.9, 1)
    blob(opts.pool.x + 1.3, opts.pool.z + 0.8, opts.pool.r * 0.55, opts.pool.r * 0.5, 0.9)
  }
  ctx.globalCompositeOperation = 'source-over'

  // smooth value noise sampled bilinearly (no blocky edges)
  const nf = (w: number, h: number, scale: number, oct: number, seed: number) => {
    const f = noiseField(w, h, scale, oct, seed)
    return (x: number, y: number) => {
      const fx = Math.max(0, Math.min(w - 1.001, (x / W) * w)), fy = Math.max(0, Math.min(h - 1.001, (y / H) * h))
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0
      const a = f[y0 * w + x0], b = f[y0 * w + x0 + 1], c = f[(y0 + 1) * w + x0], d = f[(y0 + 1) * w + x0 + 1]
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    }
  }
  const n1 = nf(128, 512, 3.2, 4, 91)
  const n2 = nf(64, 256, 1.4, 3, 93)
  const n3 = nf(128, 512, 5.5, 3, 95)
  const img = ctx.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const v0 = img.data[i] / 255
    const q = n1(x, y)
    // depth: soft blob + ragged noise only where there is already water (edges become fractal, interiors stay flat)
    const depth = Math.max(0, Math.min(1, v0 + (q - 0.5) * 0.34 * Math.min(1, v0 * 3)))
    const wx = (x / W) * 2 - 1 // −1..1 across the street
    const lane = opts.layout === 'roof' ? 0.25 : Math.exp(-wx * wx * 14) // wetter along the centre of the alley
    const damp = Math.max(0, Math.min(1, 0.22 + (n2(x, y) - 0.4) * 1.9 + lane * 0.3 + depth * 1.4))
    img.data[i] = depth * 255
    img.data[i + 1] = damp * 255
    img.data[i + 2] = n3(x, y) * 255
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = toTexture(canvas, { srgb: false, aniso: 2, mipmaps: true })
  tex.flipY = false // canvas row 0 = near end (v = 0)
  tex.needsUpdate = true
  return tex
}

/* ───────────────────────── graffiti / paste-ups / signs ───────────────────────── */

export interface TagOpts {
  text: string
  w?: number
  h?: number
  fill: string
  fill2?: string
  outline?: string
  shadow?: string
  rot?: number
  skew?: number
  seed?: number
  drips?: number
  glow?: string
  bubble?: boolean
}

export function tagTexture(o: TagOpts) {
  const W = o.w ?? 1024, H = o.h ?? 512
  const r = rng(o.seed ?? 3)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(((o.rot ?? 0) * Math.PI) / 180)
  ctx.transform(1, 0, o.skew ?? -0.18, 1, 0, 0)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const px = fitText(ctx, o.text, W * 0.82, (p) => `${p}px ${DISPLAY_FONT}`, H * 0.8)
  const outlineW = px * 0.1
  // 3D block shadow
  if (o.shadow) {
    ctx.fillStyle = o.shadow
    ctx.strokeStyle = o.shadow
    ctx.lineWidth = outlineW
    for (let i = 14; i > 0; i--) {
      ctx.strokeText(o.text, i * 0.9, i * 0.9)
      ctx.fillText(o.text, i * 0.9, i * 0.9)
    }
  }
  // outline
  ctx.strokeStyle = o.outline ?? '#f4efe6'
  ctx.lineWidth = outlineW
  ctx.strokeText(o.text, 0, 0)
  // fill gradient
  const g = ctx.createLinearGradient(0, -px / 2, 0, px / 2)
  g.addColorStop(0, o.fill2 ?? o.fill)
  g.addColorStop(0.6, o.fill)
  g.addColorStop(1, o.fill)
  ctx.fillStyle = g
  ctx.fillText(o.text, 0, 0)
  // inner highlight
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = px * 0.025
  ctx.save(); ctx.translate(-px * 0.02, -px * 0.03); ctx.strokeText(o.text, 0, 0); ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
  // drips
  const m = ctx.measureText(o.text).width
  ctx.fillStyle = o.fill
  for (let i = 0; i < (o.drips ?? 6); i++) {
    const x = r.range(-m / 2, m / 2), len = r.range(px * 0.1, px * 0.5)
    const y0 = px * 0.28
    ctx.fillRect(x - 2.5, y0, 5, len)
    ctx.beginPath(); ctx.arc(x, y0 + len, 4.2, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
  // spray overspray: a soft halo of the same paint around every stroke
  {
    const copy = makeCanvas(W, H)
    copy.ctx.drawImage(canvas, 0, 0)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    ctx.globalAlpha = 0.4
    ctx.shadowColor = o.fill
    ctx.shadowBlur = Math.max(6, H * 0.03)
    ctx.drawImage(copy.canvas, 0, 0)
    ctx.restore()
  }
  // spray speckle: fine dots beyond the edge
  ctx.globalCompositeOperation = 'destination-over'
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = o.fill
    ctx.globalAlpha = r.range(0.1, 0.45)
    ctx.beginPath(); ctx.arc(W * (0.08 + r() * 0.84), H * (0.2 + r() * 0.6), r.range(0.6, 1.9), 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return toTexture(canvas, { aniso: 8 })
}

/** A single big wildstyle-ish piece with background burst + character letters. */
export function pieceTexture(text: string, palette: { a: string; b: string; c: string }, seed: number, w = 1024, h = 640) {
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(w, h)
  // background burst
  const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.55)
  g.addColorStop(0, palette.c)
  g.addColorStop(0.65, palette.c)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const rr = (w * 0.46) * (0.82 + r() * 0.26)
    const x = w / 2 + Math.cos(a) * rr, y = h / 2 + Math.sin(a) * rr * 0.62
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.fill()
  const t = tagTexture({ text, w, h, fill: palette.a, fill2: palette.b, outline: '#f2eee6', shadow: '#0c0c10', rot: r.range(-6, 4), skew: r.range(-0.3, -0.1), seed, drips: 9 })
  ctx.drawImage(t.image as HTMLCanvasElement, 0, 0)
  t.dispose()
  return toTexture(canvas, { aniso: 8 })
}

export interface PosterOpts {
  lines: string[]
  sub?: string
  bg?: string
  fg?: string
  accent?: string
  seed?: number
  w?: number
  h?: number
  halftone?: boolean
}

export function posterTexture(o: PosterOpts) {
  const W = o.w ?? 512, H = o.h ?? 768
  const r = rng(o.seed ?? 5)
  const { canvas, ctx } = makeCanvas(W, H)
  const bg = o.bg ?? '#d8d1c0', fg = o.fg ?? '#121212', ac = o.accent ?? '#c8362a'
  ctx.clearRect(0, 0, W, H)
  const pad = 14
  tornPath(ctx, pad, pad, W - pad * 2, H - pad * 2, 9, (o.seed ?? 5) + 1)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  if (o.halftone) {
    ctx.fillStyle = ac
    for (let y = 0; y < H * 0.5; y += 14) for (let x = 0; x < W; x += 14) {
      const s = 1 + 5.5 * (1 - y / (H * 0.5))
      ctx.beginPath(); ctx.arc(x + ((y / 14) % 2 ? 7 : 0), y + 18, s, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.fillStyle = fg
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  let y = H * 0.38
  o.lines.forEach((ln, i) => {
    const px = fitText(ctx, ln, W - 60, (p) => `${p}px ${DISPLAY_FONT}`, 230)
    ctx.fillStyle = i === 0 ? fg : i % 2 ? ac : fg
    ctx.fillText(ln, 30, y)
    y += px * 1.02
  })
  if (o.sub) {
    ctx.fillStyle = fg
    ctx.font = `700 18px ${MONO_FONT}`
    ctx.fillText(o.sub, 30, H - 62)
  }
  // creases + wheat-paste wrinkles
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${r.range(0.06, 0.16)})`
    ctx.lineWidth = r.range(1, 3)
    ctx.beginPath(); ctx.moveTo(r() * W, 0)
    for (let k = 1; k <= 6; k++) ctx.lineTo(r() * W, (k / 6) * H)
    ctx.stroke()
  }
  blotches(ctx, W, H, 14, (o.seed ?? 5) + 8, [50, 40, 30], 0.05, 0.22, 30, 130)
  grain(ctx, W, H, 24, (o.seed ?? 5) + 9)
  ctx.restore()
  // slight outline
  return toTexture(canvas, { aniso: 8 })
}

export interface SignOpts {
  text: string
  w?: number
  h?: number
  bg?: string
  fg?: string
  border?: string
  small?: string
  arrow?: 'left' | 'right' | 'up'
  seed?: number
}

/** Enamel / blade-sign style board. */
export function signTexture(o: SignOpts) {
  const W = o.w ?? 512, H = o.h ?? 256
  const { canvas, ctx } = makeCanvas(W, H)
  const bg = o.bg ?? '#13213a', fg = o.fg ?? '#f1ece0'
  ctx.fillStyle = bg
  roundRect(ctx, 0, 0, W, H, 14)
  ctx.fill()
  ctx.strokeStyle = o.border ?? fg
  ctx.lineWidth = 6
  roundRect(ctx, 14, 14, W - 28, H - 28, 8)
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const small = o.small ? H * 0.22 : 0
  const px = fitText(ctx, o.text, W - 90 - (o.arrow ? 90 : 0), (p) => `${p}px ${DISPLAY_FONT}`, H * 0.62)
  ctx.fillText(o.text, W / 2 + (o.arrow === 'left' ? 40 : o.arrow === 'right' ? -40 : 0), H / 2 - small * 0.35)
  if (o.small) {
    ctx.font = `700 ${H * 0.1}px ${MONO_FONT}`
    ctx.fillText(o.small, W / 2, H / 2 + px * 0.5 + 4)
  }
  if (o.arrow) {
    ctx.save()
    ctx.translate(o.arrow === 'left' ? 64 : o.arrow === 'right' ? W - 64 : W / 2, o.arrow === 'up' ? 56 : H / 2)
    ctx.rotate(o.arrow === 'left' ? Math.PI : o.arrow === 'up' ? -Math.PI / 2 : 0)
    ctx.beginPath(); ctx.moveTo(-26, -12); ctx.lineTo(8, -12); ctx.lineTo(8, -28); ctx.lineTo(34, 0); ctx.lineTo(8, 28); ctx.lineTo(8, 12); ctx.lineTo(-26, 12); ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  blotches(ctx, W, H, 10, o.seed ?? 4, [0, 0, 0], 0.08, 0.25, 20, 90)
  grain(ctx, W, H, 14, (o.seed ?? 4) + 2)
  return toTexture(canvas, { aniso: 8 })
}

/** Painted overhead banner — the HOODDINO title as a physical object. */
export function bannerTexture(text: string) {
  const W = 2048, H = 512
  const r = rng(21)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#16140f'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 60, 3, [70, 62, 48], 0.08, 0.24, 40, 200)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const px = fitText(ctx, text, W - 190, (p) => `${p}px ${DISPLAY_FONT}`, H * 0.86)
  ctx.fillStyle = '#e8e1d0'
  ctx.fillText(text, W / 2, H / 2 + px * 0.04)
  // paint breakup — scrape the lettering
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = `rgba(0,0,0,${r.range(0.1, 0.6)})`
    ctx.fillRect(r() * W, r() * H, r.range(1, 14), r.range(1, 3))
  }
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#16140f'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  // drips
  ctx.fillStyle = '#e8e1d0'
  for (let i = 0; i < 14; i++) {
    const x = W * 0.1 + r() * W * 0.8, len = r.range(18, 90)
    ctx.fillRect(x, H * 0.72, 3.5, len)
  }
  // grommets + frame
  ctx.fillStyle = '#7d776b'
  for (const x of [34, W - 34]) for (const y of [34, H - 34]) { ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill() }
  ctx.strokeStyle = 'rgba(232,225,208,0.5)'
  ctx.lineWidth = 8
  ctx.strokeRect(14, 14, W - 28, H - 28)
  grain(ctx, W, H, 26, 31)
  return toTexture(canvas, { aniso: 8 })
}

/** Light-projected lettering (additive). */
export function projectionTexture(text: string) {
  const W = 2048, H = 512
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const px = fitText(ctx, text, W - 160, (p) => `${p}px ${DISPLAY_FONT}`, H * 0.9)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText(text, W / 2, H / 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 5
  ctx.strokeText(text, W / 2, H / 2)
  // scanlines
  ctx.globalCompositeOperation = 'destination-out'
  for (let y = 0; y < H; y += 6) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y, W, 2) }
  ctx.globalCompositeOperation = 'source-over'
  void px
  return toTexture(canvas, { aniso: 8 })
}

export function stencilTexture(text: string, color = '#e6e0cf', w = 256, h = 256) {
  const { canvas, ctx } = makeCanvas(w, h)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fitText(ctx, text, w * 0.85, (p) => `${p}px ${DISPLAY_FONT}`, h * 0.8)
  ctx.fillText(text, w / 2, h / 2)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, h * 0.34, w, 4)
  ctx.fillRect(0, h * 0.66, w, 4)
  const r = rng(9)
  for (let i = 0; i < 90; i++) ctx.fillRect(r() * w, r() * h, r.range(1, 6), r.range(1, 3))
  return toTexture(canvas, { aniso: 4 })
}

/* ───────────────────────── structure details ───────────────────────── */

export const WINDOW_VARIANTS = ['dark', 'warm', 'warm2', 'cool', 'tv', 'blind', 'boarded', 'barred', 'sheet', 'shutter', 'broken', 'ac'] as const
export type WindowVariant = (typeof WINDOW_VARIANTS)[number]

/** Twelve structurally different window states (lit / dark / boarded / barred / covered / shuttered / broken / AC-in-sash). */
export function windowTextures(): Record<WindowVariant, THREE.Texture> {
  const mk = (kind: WindowVariant, seed: number) => {
    const W = 128, H = 192
    const r = rng(seed)
    const { canvas, ctx } = makeCanvas(W, H)
    ctx.fillStyle = '#17120f'
    ctx.fillRect(0, 0, W, H)
    const gx = 10, gy = 10, gw = W - 20, gh = H - 20
    const glass = (c0: string, c1: string) => {
      const g = ctx.createLinearGradient(0, gy, 0, gy + gh)
      g.addColorStop(0, c0); g.addColorStop(1, c1)
      ctx.fillStyle = g
      ctx.fillRect(gx, gy, gw, gh)
    }
    let mullions = true
    switch (kind) {
      case 'dark': {
        glass('#34425a', '#0b0e15')
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw * 0.7, gy); ctx.lineTo(gx, gy + gh * 0.6); ctx.fill()
        break
      }
      case 'warm': {
        glass('#ffcf8a', '#d9803a')
        ctx.fillStyle = 'rgba(40,20,10,0.5)'
        ctx.fillRect(gx, gy, r.range(14, 36), gh)
        if (r() < 0.6) ctx.fillRect(gx + gw - r.range(10, 28), gy, 30, gh)
        break
      }
      case 'warm2': {
        glass('#ffe2a8', '#e6893c')
        // plant + a figure's silhouette lit from behind
        ctx.fillStyle = 'rgba(30,18,10,0.85)'
        ctx.beginPath(); ctx.ellipse(gx + 28, gy + gh - 18, 20, 26, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(gx + 22, gy + gh - 8, 12, 8)
        if (r() < 0.55) { ctx.beginPath(); ctx.arc(gx + gw - 30, gy + gh * 0.45, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(gx + gw - 41, gy + gh * 0.45 + 10, 22, gh * 0.55) }
        break
      }
      case 'cool': {
        glass('#a9d0ff', '#4a78c8')
        ctx.fillStyle = 'rgba(10,20,40,0.4)'
        ctx.fillRect(gx + gw - r.range(14, 30), gy, 30, gh)
        break
      }
      case 'tv': {
        glass('#6fa0ff', '#2c4cae')
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.fillRect(gx + 18, gy + gh * 0.4, gw - 36, gh * 0.26)
        ctx.fillStyle = 'rgba(8,10,30,0.7)'
        ctx.fillRect(gx, gy, 14, gh); ctx.fillRect(gx + gw - 14, gy, 14, gh)
        break
      }
      case 'blind': {
        glass('#d8bc86', '#8a6a3c')
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        const drop = r.range(0.35, 0.95)
        for (let y = gy; y < gy + gh * drop; y += 7) ctx.fillRect(gx, y, gw, 3)
        break
      }
      case 'boarded': {
        glass('#161310', '#0a0908')
        mullions = false
        for (let i = 0; i < 4; i++) {
          const y = gy + 6 + i * (gh / 4)
          ctx.save(); ctx.translate(W / 2, y + gh / 8); ctx.rotate(r.range(-0.07, 0.07))
          ctx.fillStyle = `rgb(${96 + r() * 36},${74 + r() * 24},${50 + r() * 16})`
          ctx.fillRect(-gw / 2 - 6, -gh / 8, gw + 12, gh / 4 - 4)
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-gw / 2 - 6, gh / 8 - 6, gw + 12, 3)
          ctx.restore()
        }
        break
      }
      case 'barred': {
        glass('#1c2536', '#07090e')
        ctx.fillStyle = '#0a0a0b'
        for (let x = gx + 6; x < gx + gw; x += 13) ctx.fillRect(x, gy, 3.5, gh)
        ctx.fillRect(gx, gy + gh * 0.32, gw, 4); ctx.fillRect(gx, gy + gh * 0.68, gw, 4)
        break
      }
      case 'sheet': {
        glass('#e9dcc4', '#a89572')
        mullions = false
        ctx.strokeStyle = 'rgba(80,60,40,0.3)'; ctx.lineWidth = 3
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(gx + r() * gw, gy); ctx.bezierCurveTo(gx + r() * gw, gy + gh * 0.3, gx + r() * gw, gy + gh * 0.6, gx + r() * gw, gy + gh); ctx.stroke() }
        ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.fillRect(gx, gy, gw, 10)
        break
      }
      case 'shutter': {
        glass('#0c1018', '#050608')
        mullions = false
        const col = ['#3d5b44', '#6a3a2e', '#4a5a6a'][seed % 3]
        for (const x of [gx - 6, gx + gw / 2]) {
          ctx.fillStyle = col; ctx.fillRect(x + 2, gy - 2, gw / 2 + 4, gh + 4)
          ctx.fillStyle = 'rgba(0,0,0,0.38)'
          for (let y = gy + 4; y < gy + gh; y += 8) ctx.fillRect(x + 6, y, gw / 2 - 4, 3)
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x + 2, gy - 2, 3, gh + 4)
        }
        break
      }
      case 'broken': {
        glass('#2a3647', '#080b11')
        ctx.strokeStyle = 'rgba(210,225,255,0.55)'; ctx.lineWidth = 1.4
        const cx = gx + gw * 0.55, cy = gy + gh * 0.35
        for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, l = r.range(22, 80); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke() }
        ctx.fillStyle = 'rgba(14,12,10,0.9)'
        ctx.beginPath(); ctx.moveTo(cx - 10, cy - 14); ctx.lineTo(cx + 28, cy - 4); ctx.lineTo(cx + 10, cy + 26); ctx.lineTo(cx - 20, cy + 14); ctx.fill()
        ctx.strokeStyle = 'rgba(205,190,150,0.55)'; ctx.lineWidth = 5
        ctx.beginPath(); ctx.moveTo(gx + 6, gy + gh * 0.9); ctx.lineTo(gx + gw - 10, gy + gh * 0.5); ctx.stroke()
        break
      }
      case 'ac': {
        glass('#232e40', '#07090d')
        ctx.fillStyle = '#b8bbb6'; ctx.fillRect(gx + 4, gy + gh * 0.36, gw - 8, gh * 0.5)
        ctx.fillStyle = '#6c6f6c'; ctx.fillRect(gx + 4, gy + gh * 0.36 + 4, gw - 8, 6)
        ctx.strokeStyle = '#3a3c3b'; ctx.lineWidth = 2
        for (let y = gy + gh * 0.5; y < gy + gh * 0.84; y += 7) { ctx.beginPath(); ctx.moveTo(gx + 12, y); ctx.lineTo(gx + gw - 12, y); ctx.stroke() }
        break
      }
    }
    if (mullions) {
      ctx.fillStyle = '#0d0a08'
      if (kind !== 'ac' && kind !== 'broken') ctx.fillRect(W / 2 - 3, gy, 6, gh)
      ctx.fillRect(gx, H * 0.4, gw, 6)
    }
    ctx.strokeStyle = '#2a211b'
    ctx.lineWidth = 8
    ctx.strokeRect(gx - 2, gy - 2, gw + 4, gh + 4)
    ctx.fillStyle = '#4a4036'
    ctx.fillRect(2, H - 10, W - 4, 8)
    // dirt running down from the sill above
    for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(10,8,6,${r.range(0.05, 0.2)})`; ctx.fillRect(r() * W, 0, r.range(2, 8), r.range(40, H)) }
    grain(ctx, W, H, 14, seed)
    return toTexture(canvas, { aniso: 4 })
  }
  const out = {} as Record<WindowVariant, THREE.Texture>
  WINDOW_VARIANTS.forEach((k, i) => (out[k] = mk(k, 1 + i)))
  return out
}

export function gratingTexture() {
  const W = 128, H = 128
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  for (let i = 0; i <= W; i += 16) { ctx.fillRect(i - 2, 0, 4, H); ctx.fillRect(0, i - 2, W, 4) }
  return toTexture(canvas, { wrap: true, srgb: false, aniso: 4 })
}

export function shutterTexture(seed = 2, color = '#5a5f58') {
  const W = 256, H = 512
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
  for (let y = 0; y < H; y += 12) {
    const g = ctx.createLinearGradient(0, y, 0, y + 12)
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, W, 12)
  }
  blotches(ctx, W, H, 18, seed, [20, 16, 12], 0.1, 0.3, 20, 90, 2.4)
  grain(ctx, W, H, 24, seed + 2)
  return toTexture(canvas, { aniso: 6 })
}

export function metalDoorTexture(seed = 6, color = '#43484a') {
  const W = 256, H = 512
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, W - 20, H - 20)
  ctx.lineWidth = 3
  ctx.strokeRect(34, 40, W - 68, H * 0.38)
  ctx.strokeRect(34, H * 0.5, W - 68, H * 0.4)
  ctx.fillStyle = 'rgba(150,150,140,0.8)'
  ctx.beginPath(); ctx.arc(W - 40, H * 0.5, 9, 0, Math.PI * 2); ctx.fill()
  for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(110,60,30,${r.range(0.05, 0.3)})`; ctx.fillRect(r() * W, r() * H, r.range(4, 24), r.range(4, 70)) }
  blotches(ctx, W, H, 14, seed, [10, 10, 10], 0.1, 0.35, 20, 80, 2)
  grain(ctx, W, H, 22, seed + 1)
  return toTexture(canvas, { aniso: 6 })
}

export function fanTexture() {
  const W = 256, H = 256
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#8c8f8c'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#1c1d1e'
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 100, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#6c6f70'
  ctx.lineWidth = 4
  for (let r = 18; r <= 100; r += 16) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke() }
  for (let a = 0; a < 12; a++) { ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos((a / 12) * Math.PI * 2) * 100, H / 2 + Math.sin((a / 12) * Math.PI * 2) * 100); ctx.stroke() }
  blotches(ctx, W, H, 8, 3, [0, 0, 0], 0.1, 0.3, 20, 80)
  grain(ctx, W, H, 18, 3)
  return toTexture(canvas, { aniso: 4 })
}

/* ───────────────────────── skyline ───────────────────────── */

export interface SkylineLayer {
  silhouette: THREE.Texture
  lights: THREE.Texture
}

export function skylineTextures(seed: number, density = 1, maxH = 0.8): SkylineLayer {
  const W = 2048, H = 512
  const r = rng(seed)
  const sil = makeCanvas(W, H)
  const lit = makeCanvas(W, H)
  let x = -20
  while (x < W + 20) {
    const bw = r.range(40, 170) * density
    // a few landmark-height buildings, many mid-rise, some low blocks: height is not uniformly random
    const roll = r()
    const bh = (roll < 0.12 ? r.range(0.7, 1) : roll < 0.55 ? r.range(0.4, 0.7) : r.range(0.2, 0.42)) * maxH * H * 1.15
    const top = H - Math.min(bh, H * 0.94)
    const g = sil.ctx.createLinearGradient(0, top, 0, H)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(205,205,218,1)')
    sil.ctx.fillStyle = g
    sil.ctx.fillRect(x, top, bw, H - top)
    // setbacks (stepped crowns)
    let tw = bw, tx = x, ty = top
    const steps = r() < 0.55 ? r.int(1, 3) : 0
    for (let k = 0; k < steps; k++) {
      const nw = tw * r.range(0.5, 0.8), nh = r.range(14, 46)
      tx += (tw - nw) * r.range(0.2, 0.8); tw = nw; ty -= nh
      sil.ctx.fillStyle = 'rgba(240,240,250,1)'
      sil.ctx.fillRect(tx, ty, tw, nh + 2)
    }
    // crowns: spire, mast, water tank, gabled top, cooling units
    const k = r()
    sil.ctx.fillStyle = 'rgba(235,235,245,1)'
    if (k < 0.2) sil.ctx.fillRect(tx + tw * 0.5 - 1.5, ty - r.range(40, 120), 3, 130)
    else if (k < 0.34) { sil.ctx.beginPath(); sil.ctx.moveTo(tx + tw * 0.5 - 16, ty); sil.ctx.lineTo(tx + tw * 0.5, ty - r.range(26, 60)); sil.ctx.lineTo(tx + tw * 0.5 + 16, ty); sil.ctx.fill() }
    else if (k < 0.5) { sil.ctx.fillRect(tx + tw * 0.2, ty - 22, 20, 22); sil.ctx.beginPath(); sil.ctx.moveTo(tx + tw * 0.2 - 3, ty - 22); sil.ctx.lineTo(tx + tw * 0.2 + 10, ty - 34); sil.ctx.lineTo(tx + tw * 0.2 + 23, ty - 22); sil.ctx.fill(); sil.ctx.fillRect(tx + tw * 0.2 + 2, ty - 4, 2, 6); sil.ctx.fillRect(tx + tw * 0.2 + 16, ty - 4, 2, 6) }
    else if (k < 0.62) { for (let q = 0; q < 3; q++) sil.ctx.fillRect(tx + 6 + q * (tw / 3), ty - r.range(6, 14), tw / 4, 14) }
    // windows: this building's own grid, own mood (dead block / lively block / office with lit floors)
    const cw = r.range(5, 9), ch = r.range(8, 14)
    const mood = r()
    const prob = mood < 0.25 ? r.range(0.02, 0.1) : mood < 0.8 ? r.range(0.15, 0.4) : r.range(0.45, 0.7)
    const cols = Math.floor((bw - 8) / cw), rows = Math.floor((H - top) / ch)
    const office = r() < 0.3
    for (let ry = 1; ry < rows; ry++) {
      const fullFloor = office && r() < 0.1
      for (let cx = 0; cx < cols; cx++) {
        if (!fullFloor && r() > prob) continue
        const cold = fullFloor || r() < 0.2
        lit.ctx.fillStyle = cold ? `rgba(${170 + r() * 40 | 0},${205 + r() * 30 | 0},255,${r.range(0.45, 0.95)})` : `rgba(255,${r.range(150, 215) | 0},${r.range(80, 150) | 0},${r.range(0.45, 1)})`
        lit.ctx.fillRect(x + 4 + cx * cw, top + ry * ch, cw * 0.55, ch * 0.5)
      }
    }
    x += bw + r.range(-8, 12)
  }
  for (const c of [sil.ctx, lit.ctx]) {
    c.globalCompositeOperation = 'destination-out'
    const g = c.createLinearGradient(0, H * 0.62, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.96)')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    c.globalCompositeOperation = 'source-over'
  }
  return {
    silhouette: toTexture(sil.canvas, { aniso: 2 }),
    lights: toTexture(lit.canvas, { aniso: 2 }),
  }
}

export function roofDeckTexture(seed = 14) {
  const W = 1024, H = 1024
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.fillStyle = '#6b6d72'
  ctx.fillRect(0, 0, W, H)
  const f = noiseField(256, 256, 1.6, 4, seed)
  const img = ctx.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (f[(y >> 2) * 256 + (x >> 2)] - 0.5) * 40
    const i = (y * W + x) * 4
    img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v * 1.05
  }
  ctx.putImageData(img, 0, 0)
  // roll seams
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  for (let x = 0; x < W; x += 256) ctx.fillRect(x, 0, 3, H)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let x = 4; x < W; x += 256) ctx.fillRect(x, 0, 2, H)
  for (let i = 0; i < 24000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(150,150,150,0.25)' : 'rgba(0,0,0,0.3)'; const s = r.range(0.6, 2); ctx.fillRect(r() * W, r() * H, s, s) }
  blotches(ctx, W, H, 40, seed + 1, [14, 12, 10], 0.1, 0.35, 30, 130)
  blotches(ctx, W, H, 12, seed + 2, [120, 140, 150], 0.05, 0.12, 40, 120)
  grain(ctx, W, H, 14, seed + 3)
  return toTexture(canvas, { wrap: true, aniso: 8 })
}

/* ───────────────────────── glow sprites ───────────────────────── */

export function glowTexture() {
  const S = 128
  const { canvas, ctx } = makeCanvas(S, S)
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return toTexture(canvas, { mipmaps: false, aniso: 1 })
}

export function softDotTexture() {
  const S = 64
  const { canvas, ctx } = makeCanvas(S, S)
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return toTexture(canvas, { mipmaps: false, aniso: 1 })
}

/* ───────────────────────── track card ───────────────────────── */

export interface CardTexOpts {
  n: number
  total: number
  title: string
  tag?: string
  cover: HTMLImageElement | ImageBitmap | HTMLCanvasElement
  coverW: number
  coverH: number
  project: string
  artist: string
  tone: number
}

export function trackCardTexture(o: CardTexOpts) {
  const W = 640, H = 896
  const { canvas, ctx } = makeCanvas(W, H)
  const r = rng(o.n * 91)
  ctx.fillStyle = '#0a0a0b'
  ctx.fillRect(0, 0, W, H)

  // artwork fragment: a different crop of the official cover on every card
  const cols = 7
  const sw = o.coverW / 3.2
  const sh = (sw * (H * 0.62)) / W
  const sx = ((o.n - 1) / (cols - 1)) * (o.coverW - sw)
  const sy = (0.18 + 0.64 * ((Math.sin(o.n * 2.1) + 1) / 2)) * (o.coverH - sh)
  const ah = H * 0.62
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, ah); ctx.clip()
  ctx.drawImage(o.cover as CanvasImageSource, sx, sy, sw, sh, 0, 0, W, ah)
  const fade = ctx.createLinearGradient(0, ah * 0.55, 0, ah)
  fade.addColorStop(0, 'rgba(10,10,11,0)')
  fade.addColorStop(1, 'rgba(10,10,11,1)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, W, ah)
  ctx.restore()

  // giant outlined number
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `${H * 0.34}px ${DISPLAY_FONT}`
  const num = String(o.n).padStart(2, '0')
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(244,239,230,0.9)'
  ctx.strokeText(num, 26, ah + 8)
  ctx.fillStyle = 'rgba(244,239,230,0.06)'
  ctx.fillText(num, 26, ah + 8)

  // title — large, wraps to two lines on long names
  ctx.fillStyle = '#f4efe6'
  const label = o.title.toUpperCase()
  const maxW = W - 56
  const words = label.split(' ')
  let lines = [label]
  let px = H * 0.125
  ctx.font = `${px}px ${DISPLAY_FONT}`
  if (ctx.measureText(label).width > maxW && words.length > 1) {
    let best = 0, bw = 1e9
    for (let k = 1; k < words.length; k++) {
      const w = Math.max(ctx.measureText(words.slice(0, k).join(' ')).width, ctx.measureText(words.slice(k).join(' ')).width)
      if (w < bw) { bw = w; best = k }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]
  }
  while (Math.max(...lines.map((l) => ctx.measureText(l).width)) > maxW && px > 30) { px -= 2; ctx.font = `${px}px ${DISPLAY_FONT}` }
  const baseY = H - 112 - (lines.length - 1) * px * 0.98
  lines.forEach((l, i) => ctx.fillText(l, 28, baseY + i * px * 0.98))
  if (o.tag) {
    ctx.font = `700 22px ${MONO_FONT}`
    ctx.fillStyle = '#c9a982'
    ctx.fillText(`(${o.tag.toUpperCase()})`, 30, H - 82)
  }
  ctx.fillStyle = 'rgba(244,239,230,0.55)'
  ctx.font = `700 19px ${MONO_FONT}`
  ctx.fillText(`${o.artist} — ${o.project}`, 30, H - 38)
  ctx.textAlign = 'right'
  ctx.fillText(`${String(o.n).padStart(2, '0')}/${String(o.total).padStart(2, '0')}`, W - 28, H - 38)
  // registration marks, corner tape
  ctx.strokeStyle = 'rgba(244,239,230,0.35)'
  ctx.lineWidth = 2
  for (const [x, y] of [[18, 18], [W - 18, 18]]) { ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke() }
  ctx.fillStyle = 'rgba(214,200,160,0.55)'
  ctx.save(); ctx.translate(W - 70, 6); ctx.rotate(0.35); ctx.fillRect(-40, 0, 90, 26); ctx.restore()
  // wear
  blotches(ctx, W, H, 14, o.n * 3, [0, 0, 0], 0.08, 0.3, 40, 160)
  grain(ctx, W, H, 18, o.n * 7)
  void r
  return toTexture(canvas, { aniso: 8 })
}

/** Ring label used by the Dualismo orbiting discs and the "return" rift. */
export function ringLabelTexture(text: string, sub?: string) {
  const S = 1024
  const { canvas, ctx } = makeCanvas(S, S)
  ctx.translate(S / 2, S / 2)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = `${text} · ${text} · ${text} · `
  ctx.font = `${S * 0.082}px ${DISPLAY_FONT}`
  const n = label.length
  for (let i = 0; i < n; i++) {
    ctx.save()
    ctx.rotate((i / n) * Math.PI * 2)
    ctx.translate(0, -S * 0.4)
    ctx.fillText(label[i], 0, 0)
    ctx.restore()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(0, 0, S * 0.33, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, S * 0.46, 0, Math.PI * 2); ctx.stroke()
  if (sub) {
    ctx.font = `700 ${S * 0.04}px ${MONO_FONT}`
    ctx.fillText(sub, 0, 0)
  }
  return toTexture(canvas, { aniso: 8 })
}

export function labelTexture(lines: { text: string; size: number; font?: 'display' | 'mono'; color?: string }[], w = 1024, h = 256, align: CanvasTextAlign = 'left') {
  const { canvas, ctx } = makeCanvas(w, h)
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  const total = lines.reduce((a, l) => a + l.size * 1.1, 0)
  let y = (h - total) / 2
  for (const l of lines) {
    ctx.font = l.font === 'mono' ? `700 ${l.size}px ${MONO_FONT}` : `${l.size}px ${DISPLAY_FONT}`
    ctx.fillStyle = l.color ?? '#f4efe6'
    ctx.fillText(l.text, align === 'left' ? 4 : align === 'center' ? w / 2 : w - 4, y + l.size * 0.55)
    y += l.size * 1.1
  }
  return toTexture(canvas, { aniso: 8 })
}

/** Torn wheat-paste sheet with a printed ring — the artwork shows through the ring (see PortalPoster). */
export function portalPaperTexture() {
  const W = 512, H = 720
  const r = rng(808)
  const { canvas, ctx } = makeCanvas(W, H)
  const pad = 16
  tornPath(ctx, pad, pad, W - pad * 2, H - pad * 2, 12, 809)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#cfc9b9'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 26, 810, [60, 50, 36], 0.06, 0.24, 30, 160)
  // printed ring + registration
  ctx.strokeStyle = '#141414'
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.arc(W / 2, H * 0.56, W * 0.356, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(W / 2, H * 0.56, W * 0.39, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#141414'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `64px ${DISPLAY_FONT}`
  ctx.fillText('UN ALTRO LATO', W / 2, H * 0.12)
  ctx.font = `700 15px ${MONO_FONT}`
  ctx.fillText('1 · 2', W / 2, H * 0.935)
  ctx.fillText('— — — — — —', W / 2, H * 0.965)
  // scribbles
  ctx.strokeStyle = 'rgba(20,20,20,0.55)'
  ctx.lineWidth = 3
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(r() * W, H * 0.22 + r() * 24); ctx.bezierCurveTo(r() * W, r() * H * 0.3, r() * W, r() * H * 0.3, r() * W, H * 0.22 + r() * 30); ctx.stroke() }
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${r.range(0.06, 0.15)})`
    ctx.lineWidth = r.range(1, 3)
    ctx.beginPath(); ctx.moveTo(r() * W, 0)
    for (let k = 1; k <= 6; k++) ctx.lineTo(r() * W, (k / 6) * H)
    ctx.stroke()
  }
  grain(ctx, W, H, 22, 811)
  ctx.restore()
  return toTexture(canvas, { aniso: 8 })
}

/** Window-grid facade for the low-poly tower field: one tile = 3.2 m × 3.4 m (one floor, one bay). */
export function towerTextures() {
  const W = 256, H = 256
  const r = rng(515)
  const base = makeCanvas(W, H)
  const lit = makeCanvas(W, H)
  const cols = 4, rows = 4
  const cw = W / cols, ch = H / rows
  base.ctx.fillStyle = '#34363e'
  base.ctx.fillRect(0, 0, W, H)
  base.ctx.fillStyle = 'rgba(255,255,255,0.05)'
  base.ctx.fillRect(0, 0, W, 3)
  lit.ctx.fillStyle = '#000'
  lit.ctx.fillRect(0, 0, W, H)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const wx = x * cw + cw * 0.18, wy = y * ch + ch * 0.2, ww = cw * 0.64, wh = ch * 0.56
    base.ctx.fillStyle = '#1b2232'
    base.ctx.fillRect(wx, wy, ww, wh)
    base.ctx.fillStyle = 'rgba(160,190,230,0.12)'
    base.ctx.fillRect(wx, wy, ww, wh * 0.4)
    const on = r() < 0.2
    if (on) {
      lit.ctx.fillStyle = r() < 0.78 ? `rgb(255,${190 + r() * 40 | 0},${110 + r() * 40 | 0})` : `rgb(170,${205 + r() * 30 | 0},255)`
      lit.ctx.fillRect(wx, wy, ww, wh)
    }
  }
  grain(base.ctx, W, H, 14, 516)
  return {
    map: toTexture(base.canvas, { wrap: true, aniso: 4 }),
    emissive: toTexture(lit.canvas, { wrap: true, aniso: 4 }),
  }
}

/* ───────────────────────── foreground dressing ───────────────────────── */

/** Hanging laundry silhouette (alpha-cut) — worn cotton in muted colours, with a wooden peg strip on top. */
export function garmentTexture(kind: 'tee' | 'trousers' | 'towel' | 'hoodie', color: string, seed = 3) {
  const W = 256, H = 384
  const r = rng(seed)
  const { canvas, ctx } = makeCanvas(W, H)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = color
  ctx.beginPath()
  if (kind === 'tee') {
    ctx.moveTo(70, 10); ctx.lineTo(186, 10); ctx.lineTo(252, 80); ctx.lineTo(214, 128); ctx.lineTo(178, 96); ctx.lineTo(182, 330)
    ctx.quadraticCurveTo(128, 346, 74, 330); ctx.lineTo(78, 96); ctx.lineTo(42, 128); ctx.lineTo(4, 80)
  } else if (kind === 'trousers') {
    ctx.moveTo(60, 8); ctx.lineTo(196, 8); ctx.lineTo(206, 372); ctx.lineTo(136, 376); ctx.lineTo(128, 130); ctx.lineTo(120, 376); ctx.lineTo(50, 372)
  } else if (kind === 'towel') {
    ctx.moveTo(40, 8); ctx.lineTo(216, 8); ctx.lineTo(220, 280); ctx.lineTo(36, 284)
  } else {
    ctx.moveTo(62, 10); ctx.lineTo(194, 10); ctx.lineTo(250, 90); ctx.lineTo(236, 260); ctx.lineTo(196, 250); ctx.lineTo(196, 340)
    ctx.quadraticCurveTo(128, 356, 60, 340); ctx.lineTo(60, 250); ctx.lineTo(20, 260); ctx.lineTo(6, 90)
  }
  ctx.closePath()
  ctx.fill()
  ctx.globalCompositeOperation = 'source-atop'
  // folds, damp patches, stripes on towels
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${r.range(0.06, 0.2)})`
    ctx.lineWidth = r.range(2, 8)
    ctx.beginPath(); ctx.moveTo(r() * W, 0); ctx.bezierCurveTo(r() * W, H * 0.3, r() * W, H * 0.6, r() * W, H); ctx.stroke()
  }
  if (kind === 'towel') { ctx.fillStyle = 'rgba(240,235,220,0.55)'; ctx.fillRect(0, 230, W, 14); ctx.fillRect(0, 252, W, 8) }
  blotches(ctx, W, H, 10, seed + 4, [30, 28, 30], 0.08, 0.3, 20, 90)
  grain(ctx, W, H, 20, seed + 6)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#6a4d33'
  ctx.fillRect(r.range(46, 60), 0, 14, 22)
  ctx.fillRect(r.range(180, 196), 0, 14, 22)
  return toTexture(canvas, { aniso: 4 })
}

/** Striped canvas shop awning (top-down faded, stained). */
export function awningTexture(a: string, b: string, seed = 6) {
  const W = 512, H = 256
  const { canvas, ctx } = makeCanvas(W, H)
  const n = 8
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? b : a; ctx.fillRect((i * W) / n, 0, W / n + 1, H) }
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 26, seed, [20, 14, 8], 0.08, 0.35, 20, 90)
  grain(ctx, W, H, 18, seed + 1)
  // scalloped valance
  ctx.globalCompositeOperation = 'destination-out'
  const sc = W / n
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(i * sc + sc / 2, H, sc / 2.4, 0, Math.PI * 2); ctx.fill() }
  return toTexture(canvas, { aniso: 4 })
}

/** Neon tube lettering on a dark acrylic plate (transparent glow, intended for additive emissive use). */
export function neonTexture(text: string, color: string, w = 512, h = 192, script = false) {
  const { canvas, ctx } = makeCanvas(w, h)
  ctx.fillStyle = '#0a0a0c'
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 3
  roundRect(ctx, 6, 6, w - 12, h - 12, 12)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const font = script ? (p: number) => `italic 700 ${p}px "Space Mono", monospace` : (p: number) => `${p}px ${DISPLAY_FONT}`
  const px = fitText(ctx, text, w - 70, font, h * 0.62)
  void px
  ctx.lineJoin = 'round'
  for (const [blur, lw, a] of [[26, 9, 0.55], [12, 6, 0.8], [4, 3.2, 1]] as const) {
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    ctx.strokeStyle = a === 1 ? '#fff6ee' : color
    ctx.lineWidth = lw
    ctx.globalAlpha = a
    ctx.strokeText(text, w / 2, h / 2)
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  return toTexture(canvas, { aniso: 4 })
}
