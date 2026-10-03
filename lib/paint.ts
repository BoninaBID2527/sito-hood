import * as THREE from 'three'
import { rng } from './math'

export const DISPLAY_FONT = 'Anton, "Arial Narrow", Impact, sans-serif'
export const MONO_FONT = '"Space Mono", ui-monospace, Menlo, monospace'

const registry = new Set<THREE.Texture>()

export function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!
  return { canvas, ctx }
}

export interface TexOpts {
  srgb?: boolean
  repeat?: [number, number]
  wrap?: boolean
  aniso?: number
  mipmaps?: boolean
  channel?: number
}

export function toTexture(canvas: HTMLCanvasElement, o: TexOpts = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  if (o.wrap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
  }
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1])
  t.anisotropy = o.aniso ?? 8
  t.generateMipmaps = o.mipmaps !== false
  t.minFilter = t.generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  if (o.channel != null) t.channel = o.channel
  t.needsUpdate = true
  registry.add(t)
  return t
}

export function track<T extends THREE.Texture>(t: T): T {
  registry.add(t)
  return t
}

export function disposeAllTextures() {
  registry.forEach((t) => t.dispose())
  registry.clear()
}

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
export const idle = () => new Promise<void>((r) => setTimeout(r, 0))

export const rgb = (r: number, g: number, b: number, a = 1) =>
  `rgba(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))},${a})`

/** Add monochrome / coloured grain directly to pixels. */
export function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1, tint = 0) {
  const r = rng(seed)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n * (1 + tint)
    d[i + 1] += n
    d[i + 2] += n * (1 - tint)
  }
  ctx.putImageData(img, 0, 0)
}

/** Soft stains / grime blotches. */
export function blotches(
  ctx: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number,
  color: [number, number, number], aMin: number, aMax: number, rMin: number, rMax: number, stretchY = 1,
) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, rad = r.range(rMin, rMax)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    const a = r.range(aMin, aMax)
    g.addColorStop(0, rgb(...color, a))
    g.addColorStop(1, rgb(...color, 0))
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, stretchY)
    ctx.translate(-x, -y)
    ctx.fillStyle = g
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    ctx.restore()
  }
}

/** Fractal value-noise field into a Float32 array (cheap, tileable-ish via wrapping lattice). */
export function noiseField(w: number, h: number, scale: number, octaves: number, seed: number) {
  const r = rng(seed)
  const lat = 256
  const grid = new Float32Array(lat * lat)
  for (let i = 0; i < grid.length; i++) grid[i] = r()
  const at = (x: number, y: number) => grid[((y & (lat - 1)) * lat + (x & (lat - 1)))]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let amp = 1, sum = 0, tot = 0, f = scale
      for (let o = 0; o < octaves; o++) {
        const fx = (x / w) * f * 8, fy = (y / h) * f * 8
        const x0 = Math.floor(fx), y0 = Math.floor(fy)
        const tx = smooth(fx - x0), ty = smooth(fy - y0)
        const a = at(x0 + o * 17, y0 + o * 31), b = at(x0 + 1 + o * 17, y0 + o * 31)
        const c = at(x0 + o * 17, y0 + 1 + o * 31), d = at(x0 + 1 + o * 17, y0 + 1 + o * 31)
        sum += (a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty) * amp
        tot += amp
        amp *= 0.5
        f *= 2
      }
      out[y * w + x] = sum / tot
    }
  }
  return out
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Fit a single line of text into maxW by scaling font size. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: (px: number) => string, start = 400) {
  let px = start
  ctx.font = font(px)
  const w = ctx.measureText(text).width
  if (w > maxW) px = (px * maxW) / w
  ctx.font = font(px)
  return px
}

/** Torn-paper silhouette path around a rect. */
export function tornPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, jag: number, seed: number) {
  const r = rng(seed)
  ctx.beginPath()
  const step = 10
  ctx.moveTo(x, y)
  for (let i = step; i <= w; i += step) ctx.lineTo(x + i, y + (r() - 0.5) * jag)
  for (let i = step; i <= h; i += step) ctx.lineTo(x + w + (r() - 0.5) * jag, y + i)
  for (let i = step; i <= w; i += step) ctx.lineTo(x + w - i, y + h + (r() - 0.5) * jag)
  for (let i = step; i <= h; i += step) ctx.lineTo(x + (r() - 0.5) * jag, y + h - i)
  ctx.closePath()
}
