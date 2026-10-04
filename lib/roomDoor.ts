import { rng } from './math'
import { makeCanvas, toTexture, grain } from './paint'
import { FONT } from './graffiti'
import { roomCopy } from '@/data/room'

/** Small textures for the street entrance (kept apart from lib/roomTextures so the room's own textures stay in the lazy chunk). */

/** quilted, padded studio door with a scuffed kick plate */
export function doorLeafTexture() {
  const W = 256, H = 512
  const { canvas, ctx } = makeCanvas(W, H)
  const r = rng(61)
  ctx.fillStyle = '#2a1618'
  ctx.fillRect(0, 0, W, H)
  // quilting: diamond seams with a button in each cell
  const step = 64
  for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) {
    const cx = x + (Math.floor(y / step) % 2 ? step / 2 : 0), cy = y
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, step * 0.6)
    g.addColorStop(0, 'rgba(120,52,48,0.9)'); g.addColorStop(1, 'rgba(30,14,16,0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - step / 2, cy - step / 2, step, step)
    ctx.fillStyle = '#0d0809'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2
  for (let i = -8; i < 16; i++) { ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step + H, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * step + H, 0); ctx.lineTo(i * step, H); ctx.stroke() }
  // kick plate + push bar
  const kg = ctx.createLinearGradient(0, H * 0.9, 0, H)
  kg.addColorStop(0, '#6b6e70'); kg.addColorStop(1, '#4a4c4e')
  ctx.fillStyle = kg; ctx.fillRect(0, H * 0.9, W, H * 0.1)
  ctx.fillStyle = '#8e9092'; ctx.fillRect(W * 0.12, H * 0.5, W * 0.76, 10)
  for (let i = 0; i < 60; i++) { ctx.strokeStyle = `rgba(210,200,190,${0.05 + r() * 0.1})`; ctx.lineWidth = 1; ctx.beginPath(); const x = r() * W, y = H * 0.9 + r() * H * 0.1; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 6); ctx.stroke() }
  grain(ctx, W, H, 0.07, 62)
  return toTexture(canvas, { aniso: 8 })
}

/** corrugated painted steel for the prefab (vertical ribs, rust bleeding from the seams) */
export function corrugatedTexture() {
  const S = 256
  const { canvas, ctx } = makeCanvas(S, S)
  const r = rng(63)
  ctx.fillStyle = '#26302f'
  ctx.fillRect(0, 0, S, S)
  for (let x = 0; x < S; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.09)'); g.addColorStop(0.5, 'rgba(0,0,0,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)')
    ctx.fillStyle = g; ctx.fillRect(x, 0, 16, S)
  }
  for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(${110 + r() * 40},${60 + r() * 20},30,${0.08 + r() * 0.14})`; ctx.fillRect(r() * S, r() * S * 0.5, 2 + r() * 5, 20 + r() * 120) }
  grain(ctx, S, S, 0.07, 64)
  const t = toTexture(canvas, { aniso: 8, wrap: true })
  return t
}

/** enamel plate over the door */
export function doorSignTexture() {
  const W = 768, H = 192
  const { canvas, ctx } = makeCanvas(W, H)
  const r = rng(404)
  ctx.fillStyle = '#12161a'; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#e9d9b8'; ctx.lineWidth = 5; ctx.strokeRect(12, 12, W - 24, H - 24)
  ctx.fillStyle = '#efe2c4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `${H * 0.4}px ${FONT.anton}`
  ctx.fillText(roomCopy.title, W / 2, H * 0.5)
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(90,86,80,${0.4 + r() * 0.4})`; ctx.beginPath(); ctx.arc(r() * W, r() * H, 1 + r() * 4, 0, Math.PI * 2); ctx.fill() }
  grain(ctx, W, H, 0.08, 10)
  return toTexture(canvas, { aniso: 8 })
}

/** soft vertical light spill (additive, used on the ground and as a faint cone in front of the open door) */
export function spillTexture() {
  const W = 64, H = 128
  const { canvas, ctx } = makeCanvas(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const m = ctx.createLinearGradient(0, 0, W, 0)
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.5, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = m; ctx.fillRect(0, 0, W, H)
  return toTexture(canvas, { mipmaps: false, aniso: 1 })
}

