import * as THREE from 'three'
import { rng } from './math'
import { makeCanvas, toTexture } from './paint'

/**
 * THE HOODDINO ROOM — procedural surface textures (V3.6). Each is a small seamless tile in a neutral tone: the colour comes from vertex
 * colours, the texture only carries the material's grain / weave / mottling at a believable physical scale.
 */

/** seamless value noise, cx × cy lattice cells over a w × h grid, 0..1 */
function tile2(w: number, h: number, cx: number, cy: number, seed: number) {
  const r = rng(seed)
  const g = new Float32Array(cx * cy)
  for (let i = 0; i < g.length; i++) g[i] = r()
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * cy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), ya = y0 % cy, yb = (y0 + 1) % cy
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * cx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), xa = x0 % cx, xb = (x0 + 1) % cx
      const a = g[ya * cx + xa] + (g[ya * cx + xb] - g[ya * cx + xa]) * sx
      const b = g[yb * cx + xa] + (g[yb * cx + xb] - g[yb * cx + xa]) * sx
      out[y * w + x] = a + (b - a) * sy
    }
  }
  return out
}
function fbmTile(w: number, h: number, cx: number, cy: number, oct: number, seed: number) {
  const out = new Float32Array(w * h)
  let amp = 1, tot = 0
  for (let o = 0; o < oct; o++) {
    const n = tile2(w, h, cx << o, cy << o, seed + o * 17)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    tot += amp; amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot
  return out
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** painted plaster: soft mottling, roller streaks, orange-peel stipple, a few hairline cracks and nail holes. Mean ≈ 0.84 (the paint colour is the vertex colour). */
export function plasterTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const img = ctx.createImageData(size, size)
  const d = img.data
  const m1 = fbmTile(size, size, 3, 3, 4, 11)
  const m2 = tile2(size, size, Math.round(size / 4), Math.round(size / 4), 12)
  const m3 = tile2(size, size, Math.round(size / 7), 2, 13)
  for (let i = 0; i < size * size; i++) {
    const l = (0.84 + (m1[i] - 0.5) * 0.2 + (m2[i] - 0.5) * 0.085 + (m3[i] - 0.5) * 0.05) * 255
    d[i * 4] = clamp255(l * 1.0); d[i * 4 + 1] = clamp255(l * 0.99); d[i * 4 + 2] = clamp255(l * 0.965); d[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const r = rng(77)
  // hairline cracks (a random walk with a faint light edge)
  for (let k = 0; k < 3; k++) {
    let x = size * (0.15 + r() * 0.7), y = size * (0.15 + r() * 0.7), a = r() * 6.28
    const pts: [number, number][] = [[x, y]]
    const n = 28 + Math.floor(r() * 40)
    for (let i = 0; i < n; i++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * size * 0.012; y += Math.sin(a) * size * 0.012; pts.push([x, y]) }
    for (const [off, col, w] of [[1, 'rgba(255,250,240,0.07)', 1], [0, 'rgba(34,30,26,0.32)', 1]] as const) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath()
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + off, py + off) : ctx.moveTo(px + off, py + off)))
      ctx.stroke()
    }
  }
  // nail / screw holes
  for (let i = 0; i < 5; i++) {
    const x = r() * size, y = r() * size
    ctx.fillStyle = 'rgba(30,26,22,0.45)'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 6.28); ctx.fill()
    ctx.fillStyle = 'rgba(255,250,240,0.1)'; ctx.beginPath(); ctx.arc(x + 1, y + 1, 1.6, 0, 6.28); ctx.fill()
  }
  return toTexture(canvas, { aniso: 8, wrap: true })
}

/** dark-stained plank floor, boards run along v (the room's depth): per-board tone, grain streaks, butt joints, bevelled seams. 12 boards across the tile. */
export function plankTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const img = ctx.createImageData(size, size)
  const d = img.data
  const r = rng(31)
  const N = 12
  const bw = size / N
  const g1 = tile2(256, 256, 38, 3, 21), g2 = tile2(256, 256, 120, 9, 22), g3 = tile2(256, 256, 9, 2, 23)
  const board = Array.from({ length: N }, () => {
    const nseg = r() < 0.55 ? 1 : 2
    return { nseg, off: r() * size, seg: Array.from({ length: nseg }, () => ({ t: 0.82 + r() * 0.32, w: (r() - 0.5) * 0.06, ox: Math.floor(r() * 256), oy: Math.floor(r() * 256) })) }
  })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bi = Math.min(N - 1, Math.floor(x / bw)), u = (x - bi * bw) / bw
      const b = board[bi]
      const segLen = size / b.nseg
      const yy = (y + b.off) % size
      const si = Math.min(b.nseg - 1, Math.floor(yy / segLen))
      const s = b.seg[si]
      const tx = (Math.floor(u * 40) + s.ox) & 255, ty = (Math.floor(y * 0.25) + s.oy) & 255
      const gx = (x * 0.35 + s.ox) & 255
      const grain = g1[ty * 256 + ((gx + 256) & 255)] * 0.55 + g2[ty * 256 + tx] * 0.3 + g3[ty * 256 + ((x * 0.1 + s.oy) & 255)] * 0.5
      let l = s.t * (0.7 + 0.4 * grain) * 0.62
      const gap = 1.6 / bw
      if (u < gap || u > 1 - gap) l *= 0.2
      else if (u < gap * 2.4) l *= 1.1
      const jd = Math.abs(yy - si * segLen)
      if (jd < 1.8 || Math.abs(yy - (si + 1) * segLen) < 1.8) l *= 0.3
      const i = (y * size + x) * 4
      d[i] = clamp255((92 + s.w * 255) * l); d[i + 1] = clamp255(70 * l); d[i + 2] = clamp255((54 - s.w * 255) * l); d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  // wear: faint pale scuff strokes (no coloured specks)
  for (let i = 0; i < 38; i++) {
    ctx.strokeStyle = `rgba(214,190,160,${0.025 + r() * 0.045})`; ctx.lineWidth = 1 + r() * 1.5
    const x = r() * size, y = r() * size
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 22, y + (r() - 0.5) * 90); ctx.stroke()
  }
  return toTexture(canvas, { aniso: 8, wrap: true })
}

/** furniture wood: long grain along u, growth-ring banding, pores. Mid brown, tinted per part by vertex colour. */
export function woodGrainTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const img = ctx.createImageData(size, size)
  const d = img.data
  const a = tile2(size, size, 3, Math.round(size / 3.2), 41), b = tile2(size, size, 6, Math.round(size / 1.6), 42), slow = fbmTile(size, size, 2, 2, 3, 43)
  const r = rng(44)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const ring = 0.5 + 0.5 * Math.sin(y * 0.09 + slow[i] * 14)
      const l = 0.58 + a[i] * 0.3 + b[i] * 0.14 + ring * 0.12 - 0.1
      d[i * 4] = clamp255(l * 214); d[i * 4 + 1] = clamp255(l * 168); d[i * 4 + 2] = clamp255(l * 122); d[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  for (let i = 0; i < size * 1.2; i++) {
    ctx.strokeStyle = `rgba(40,22,10,${0.1 + r() * 0.16})`; ctx.lineWidth = 1
    const x = r() * size, y = r() * size
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 + r() * 14, y + (r() - 0.5) * 0.6); ctx.stroke()
  }
  return toTexture(canvas, { aniso: 4, wrap: true })
}

/** woven upholstery / acoustic cloth (neutral, tinted by vertex colour) */
export function weaveTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const img = ctx.createImageData(size, size)
  const d = img.data
  const slub = tile2(size, size, Math.round(size / 10), Math.round(size / 10), 51)
  const warpN = tile2(size, size, Math.round(size / 4), 2, 52), weftN = tile2(size, size, 2, Math.round(size / 4), 53)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const over = (((x >> 1) + (y >> 1)) & 1) === 0
      const fx = (x & 1) / 2, fy = (y & 1) / 2
      const shade = over ? 0.78 + 0.22 * Math.sin(Math.PI * (fx + 0.25)) + (warpN[i] - 0.5) * 0.25 : 0.7 + 0.22 * Math.sin(Math.PI * (fy + 0.25)) + (weftN[i] - 0.5) * 0.25
      const l = (0.78 + (slub[i] - 0.5) * 0.3) * shade
      d[i * 4] = clamp255(l * 255); d[i * 4 + 1] = clamp255(l * 253); d[i * 4 + 2] = clamp255(l * 250); d[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return toTexture(canvas, { aniso: 4, wrap: true })
}

/** fine mottled grain for foam / rubber / cases */
export function grainTex(size: number) {
  const { canvas, ctx } = makeCanvas(size, size)
  const img = ctx.createImageData(size, size)
  const d = img.data
  const a = tile2(size, size, size / 2, size / 2, 61), b = fbmTile(size, size, 4, 4, 3, 62)
  for (let i = 0; i < size * size; i++) {
    const l = 0.62 + (a[i] - 0.5) * 0.4 + (b[i] - 0.5) * 0.3
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp255(l * 255); d[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return toTexture(canvas, { aniso: 2, wrap: true })
}

/** a worn woven rug: bordered field with a lozenge lattice (non-repeating, uv 0..1 over the whole rug) */
export function rugTex(w: number, h: number) {
  const { canvas, ctx } = makeCanvas(w, h)
  const r = rng(71)
  ctx.fillStyle = '#7a2f2d'; ctx.fillRect(0, 0, w, h)
  const bd = w * 0.07
  // borders
  const band = (inset: number, th: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = th; ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2) }
  band(bd * 0.35, bd * 0.4, '#2a3444'); band(bd * 0.95, bd * 0.18, '#c9ab72'); band(bd * 1.35, bd * 0.5, '#5a2220'); band(bd * 1.85, bd * 0.12, '#c9ab72')
  // lozenge lattice in the field
  const x0 = bd * 2.1, y0 = bd * 2.1, fw = w - x0 * 2, fh = h - y0 * 2
  const nx = 6, ny = 4
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + ((i + 0.5) * fw) / nx, cy = y0 + ((j + 0.5) * fh) / ny, rx = fw / nx / 2 * 0.86, ry = fh / ny / 2 * 0.86
    ctx.fillStyle = (i + j) % 2 ? '#9a3e34' : '#3a4658'
    ctx.beginPath(); ctx.moveTo(cx, cy - ry); ctx.lineTo(cx + rx, cy); ctx.lineTo(cx, cy + ry); ctx.lineTo(cx - rx, cy); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#c9ab72'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = '#c9ab72'; ctx.beginPath(); ctx.arc(cx, cy, Math.min(rx, ry) * 0.16, 0, 6.28); ctx.fill()
  }
  // weave + wear
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const n = tile2(w, h, Math.round(w / 3), Math.round(h / 3), 72), wear = fbmTile(w, h, 3, 2, 3, 73)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / (w * 0.5)
    const k = (0.82 + (n[i] - 0.5) * 0.3 + (((x + y) & 1) ? 0.05 : -0.03)) * (0.86 + 0.28 * wear[i]) * (0.9 + 0.1 * Math.min(1, edge * 8))
    const lift = Math.max(0, wear[i] - 0.62) * 40
    d[i * 4] = clamp255(d[i * 4] * k + lift); d[i * 4 + 1] = clamp255(d[i * 4 + 1] * k + lift * 0.9); d[i * 4 + 2] = clamp255(d[i * 4 + 2] * k + lift * 0.8)
  }
  ctx.putImageData(img, 0, 0)
  void r
  return toTexture(canvas, { aniso: 4 })
}

/**
 * A tiny cube "light probe" of the room for glass, metal and glossy plastic (no PMREM, no render pass): 16 px faces, linear filtered.
 * Faces are in WORLD axes; the room group is rotated +90° about y, so room +z (the door side) is world +x and room −z (the back wall) is world −x.
 */
export function roomProbe() {
  const faces: HTMLCanvasElement[] = []
  const mk = (draw: (c: CanvasRenderingContext2D, s: number) => void) => {
    const { canvas, ctx } = makeCanvas(16, 16)
    draw(ctx, 16)
    faces.push(canvas)
  }
  const wall = (top: string, bottom: string, spots: [number, number, number, number, string][] = []) => (c: CanvasRenderingContext2D, s: number) => {
    const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, top); g.addColorStop(1, bottom)
    c.fillStyle = g; c.fillRect(0, 0, s, s)
    for (const [x, y, w, h, col] of spots) { c.fillStyle = col; c.fillRect(x, y, w, h) }
  }
  // order: +x (door side: warm dusk through the aperture), −x (back wall: monitors, LED), +y (ceiling: two fixtures), −y (floor), +z (room right wall… world +z = room −x), −z
  mk(wall('#34343c', '#4a3c30', [[5, 4, 6, 9, '#b8946a']]))
  mk(wall('#262b36', '#141316', [[3, 6, 4, 5, '#7f93b8'], [9, 4, 4, 7, '#a89a84'], [0, 1, 16, 1, '#3a58c8']]))
  mk((c, s) => { c.fillStyle = '#1c1d22'; c.fillRect(0, 0, s, s); c.fillStyle = '#b8c4e0'; c.fillRect(2, 6, 12, 1); c.fillRect(2, 11, 12, 1) })
  mk((c, s) => { c.fillStyle = '#2a1f1a'; c.fillRect(0, 0, s, s); c.fillStyle = '#4a3828'; c.fillRect(4, 4, 8, 8) })
  mk(wall('#2a2d35', '#18171a', [[4, 5, 6, 5, '#8a7560']]))
  mk(wall('#2c3038', '#161517', [[6, 4, 4, 6, '#7888a8']]))
  const t = new THREE.CubeTexture(faces)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}
