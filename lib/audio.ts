import { audioConfig } from '@/data/audio'

/**
 * Optional audio architecture. NOTHING plays until `start()` is called from a user gesture.
 * - ambient bed: a licensed loop from data/audio.ts, or a tiny synthesised room tone fallback
 * - UI sounds: tiny synthesised thud / whoosh (not music, not previews)
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambientEl: HTMLAudioElement | null = null
  private nodes: AudioNode[] = []
  private on = false

  private ensure() {
    if (this.ctx) return this.ctx
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  start() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    this.on = true
    ctx.resume()
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5)
    if (this.nodes.length || this.ambientEl) return
    if (audioConfig.ambient) {
      const el = new Audio(audioConfig.ambient)
      el.loop = true
      el.volume = 0.5
      this.ambientEl = el
      el.play().catch(() => undefined)
      return
    }
    // synthesised "city at distance": brown noise through a slow low-pass + a gentle wind band
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.2
      }
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    const g = ctx.createGain()
    g.gain.value = 0.22
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoG = ctx.createGain()
    lfoG.gain.value = 140
    lfo.connect(lfoG).connect(lp.frequency)
    src.connect(lp).connect(g).connect(this.master)
    src.start()
    lfo.start()
    this.nodes.push(src, lfo, lp, g)
  }

  stop() {
    if (!this.ctx || !this.master) return
    this.on = false
    this.master.gain.cancelScheduledValues(this.ctx.currentTime)
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8)
    this.ambientEl?.pause()
    if (this.ambientEl && this.on) this.ambientEl.play().catch(() => undefined)
  }

  /** Slightly muffle the room when we go through the liquid / tunnel. */
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    if (!this.ctx || !this.master || !this.on) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  thud() { this.tone(90, 0.35, 'sine', 0.35, 42) }
  tick() { this.tone(1800, 0.04, 'square', 0.02) }
  whoosh() { this.tone(180, 1.6, 'sawtooth', 0.05, 900) }
}

export const audio = new AudioEngine()
