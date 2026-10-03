import type * as THREE from 'three'
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
  private noise: AudioBuffer | null = null
  private emitters: Emitter[] = []
  private world: 'alley' | 'roof' | 'dualism' = 'alley'
  private nextDrip = 0
  private dripAt = 0

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
    this.buildSpatial()
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
    g.gain.value = 0.15
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

  /** shared looping noise → every positional bed is a differently filtered copy of it */
  private noiseBuf(ctx: AudioContext) {
    if (this.noise) return this.noise
    const len = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return (this.noise = buf)
  }

  private bed(world: Emitter['world'], base: number, pos: [number, number, number] | null, build: (ctx: AudioContext, out: AudioNode) => void) {
    const ctx = this.ctx!, master = this.master!
    const gain = ctx.createGain()
    gain.gain.value = 0
    let panner: PannerNode | undefined
    if (pos) {
      panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 6
      panner.rolloffFactor = 1.1
      panner.positionX.value = pos[0]; panner.positionY.value = pos[1]; panner.positionZ.value = pos[2]
      gain.connect(panner).connect(master)
    } else gain.connect(master)
    build(ctx, gain)
    this.emitters.push({ gain, base, world, panner })
  }

  private noiseSrc(ctx: AudioContext, type: BiquadFilterType, f: number, q = 0.7) {
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf(ctx)
    src.loop = true
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const flt = ctx.createBiquadFilter()
    flt.type = type; flt.frequency.value = f; flt.Q.value = q
    src.connect(flt)
    src.start(0, Math.random() * 2)
    return flt
  }

  /** Positioned ambience. Abstract, synthesised, never a fake song. Only built after the visitor enables sound. */
  private buildSpatial() {
    if (this.emitters.length || !this.ctx || !this.master) return
    // ── alley
    this.bed('alley', 0.55, [0, 6, -135], (ctx, out) => { this.noiseSrc(ctx, 'bandpass', 180, 0.5).connect(out) }) // distant traffic
    this.bed('alley', 0.05, [-3.4, 4.2, -22], (ctx, out) => { // electrical hum at a lamp
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260
      o.connect(lp).connect(out); o.start()
    })
    this.bed('alley', 0.5, [3.6, 3.0, -34], (ctx, out) => { // ventilation fan
      const f = this.noiseSrc(ctx, 'bandpass', 520, 1.2)
      const lfo = ctx.createOscillator(); lfo.frequency.value = 2.4
      const lg = ctx.createGain(); lg.gain.value = 0.35
      const am = ctx.createGain(); am.gain.value = 0.65
      lfo.connect(lg).connect(am.gain); lfo.start()
      f.connect(am).connect(out)
    })
    this.bed('alley', 0.14, [0, 2.5, -70], (ctx, out) => { this.noiseSrc(ctx, 'lowpass', 140).connect(out) }) // city body
    // ── rooftop
    this.bed('roof', 0.5, null, (ctx, out) => { // wind
      const f = this.noiseSrc(ctx, 'bandpass', 420, 0.35)
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09
      const lg = ctx.createGain(); lg.gain.value = 260
      lfo.connect(lg).connect(f.frequency); lfo.start()
      f.connect(out)
    })
    this.bed('roof', 0.6, [-12, -18, -30], (ctx, out) => { this.noiseSrc(ctx, 'bandpass', 220, 0.6).connect(out) }) // street far below
    this.bed('roof', 0.045, [7, 2, -14], (ctx, out) => { // structural hum
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 55
      o.connect(out); o.start()
    })
    // ── DUALISMO: abstract low presence
    this.bed('dualism', 0.05, null, (ctx, out) => {
      for (const [fr, dt] of [[49, 0], [73.5, 6], [98.5, -5]] as const) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; o.detune.value = dt
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.05
        const lg = ctx.createGain(); lg.gain.value = 3
        lfo.connect(lg).connect(o.detune); lfo.start(); o.start()
        o.connect(out)
      }
    })
  }

  /** called every frame from the scene: listener follows the camera, beds cross-fade by world, drips land in the alley */
  update(cam: THREE.Camera, world: 'alley' | 'roof' | 'dualism', t: number) {
    const ctx = this.ctx
    if (!ctx || !this.on || !this.emitters.length) return
    const L = ctx.listener
    const e = cam.matrixWorld.elements
    const px = e[12], py = e[13], pz = e[14]
    const fx = -e[8], fy = -e[9], fz = -e[10]
    if (L.positionX) {
      const now = ctx.currentTime
      L.positionX.setTargetAtTime(px, now, 0.05); L.positionY.setTargetAtTime(py, now, 0.05); L.positionZ.setTargetAtTime(pz, now, 0.05)
      L.forwardX.setTargetAtTime(fx, now, 0.08); L.forwardY.setTargetAtTime(fy, now, 0.08); L.forwardZ.setTargetAtTime(fz, now, 0.08)
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0
    }
    if (world !== this.world) this.world = world
    for (const em of this.emitters) em.gain.gain.setTargetAtTime(em.world === this.world ? em.base : 0, ctx.currentTime, 0.9)
    if (world === 'alley' && t > this.nextDrip) {
      this.nextDrip = t + 2.2 + Math.random() * 4.5
      this.dripAt = (this.dripAt + 1) % 3
      const spots: [number, number, number][] = [[-1.9, 0.1, -18], [2.2, 0.1, -46], [-2.6, 1.8, -58]]
      this.drip(spots[this.dripAt])
    }
  }

  private drip(pos: [number, number, number]) {
    const ctx = this.ctx!, t = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createPanner()
    p.panningModel = 'HRTF'; p.refDistance = 3
    p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]
    o.type = 'sine'
    o.frequency.setValueAtTime(1400 + Math.random() * 500, t)
    o.frequency.exponentialRampToValueAtTime(520, t + 0.07)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g).connect(p).connect(this.master!)
    o.start(t); o.stop(t + 0.2)
  }

  /** Faint, far-off two-note swell — the answer of the impossible puddle (only when sound is on). */
  far() {
    if (!this.ctx || !this.master || !this.on) return
    const ctx = this.ctx, t = ctx.currentTime
    for (const [fr, v] of [[174.6, 0.016], [261.6 * 1.5, 0.008]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 700
      o.type = 'sine'; o.frequency.value = fr; o.detune.value = (Math.random() - 0.5) * 14
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(v, t + 1.1)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2)
      o.connect(lp).connect(g).connect(this.master)
      o.start(t); o.stop(t + 4.4)
    }
  }
  /** a breath of glass when the anamorphic mark locks in */
  shimmer() {
    this.tone(1320, 1.4, 'sine', 0.006)
    this.tone(1980, 1.8, 'sine', 0.004)
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
  tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
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

type Emitter = { gain: GainNode; base: number; world: 'alley' | 'roof' | 'dualism'; pos?: THREE.Vector3; panner?: PannerNode }

export const audio = new AudioEngine()
