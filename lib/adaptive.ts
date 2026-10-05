import { SETTINGS, TIERS, type Tier } from './quality'

/**
 * Runtime quality adaptation (V3.5).
 *
 * What the real-device report taught us: the V3.4 manager needed ~20 s to settle and every DPR step re-allocated the HDR/MSAA
 * target (itself a hitch). The new policy:
 *  · the first lever is the INTERNAL RENDER SCALE — the scene is drawn into a smaller viewport of the same target (no re-allocation,
 *    takes effect on the next frame). It is quantised to a few levels, floored so the effective density never becomes visibly soft.
 *  · 0.5 s decision windows; a bad window needs only one confirmation, a catastrophic one (< 24 fps) acts at once, and the step is
 *    PROPORTIONAL to how far over budget we are (scale ∝ sqrt(budget / frame time)) — a tablet that starts too heavy settles in ~1.5 s.
 *  · CPU- vs GPU-bound: if the main thread itself is the limit, shrinking pixels cannot help → go straight to the tier (fewer draw calls,
 *    sparser reflections, fewer particles).
 *  · only when the scale is at its floor does the TIER drop (the destructive lever, re-allocates buffers once).
 *  · restoring is a PROBE: one level up after a long calm stretch; a probe that fails is reverted and that level is locked out for an
 *    exponentially growing time → no oscillation, a stable lower level wins over a flapping higher one.
 *  · a stable ~30 fps on a heavy device is accepted: when the floor/lowest tier is reached nothing else is changed.
 *  · scene changes (alley → roof → DUALISMO) and tab switches get a short grace period (shader compiles are not evidence).
 */
export interface AdaptiveOpts {
  start: Tier
  /** best tier we are allowed to climb back to (the device's initial tier) */
  ceiling: Tier
  /** canvas DPR for the initial tier */
  dpr: number
  /** first scale (touch devices start slightly below 1 and ramp up once proven) */
  scale0?: number
  apply: (tier: Tier, dpr: number, scale: number) => void
}

export interface PerfStats {
  /** smoothed frame time in ms (EMA) and fps derived from it */
  ms: number
  fps: number
  dpr: number
  scale: number
  tier: Tier
  /** frame-pacing over the last ~4 s */
  p95: number
  p99: number
  worst: number
  /** frames longer than 50 ms since start */
  hitches: number
  /** how many times the manager changed something */
  changes: number
  /** 'gpu' | 'cpu' | '-' */
  bound: string
  cpu: number
  /** the last adaptation events, newest last */
  events: string[]
}

const BUDGET_MS = 16.7
const DEGRADE_MS = 19.5 // window average over this (≈ < 51 fps) is "bad"
const SEVERE_MS = 42 // ≈ < 24 fps: act on a single window
const RESTORE_MS = 17.6 // at/under this (a locked 60) counts as calm
const WINDOW = 0.5
const CONFIRM = 2 // consecutive bad windows needed (severe needs 1)
const DEGRADE_GAP = 1.2 // s between two reductions (long enough to observe the effect of the last one)
const PROBE_BASE = 10 // s of calm before the first probe upwards
const PROBE_GAP_MAX = 120
const PROBE_FAIL_WITHIN = 5 // s: a probe that turns bad inside this window failed
const CPU_BOUND = 0.72 // main-thread share of the frame above which pixels are not the problem
const RING = 240

/** the discrete scales the manager moves between (quantised: no continuous wobble) */
const LEVELS = [1, 0.9, 0.82, 0.75, 0.68, 0.62, 0.56, 0.5]

export function createAdaptive(o: AdaptiveOpts) {
  let tier = o.start
  let dpr = o.dpr
  const ceilIdx = TIERS.indexOf(o.ceiling)
  let t = 0
  let graceUntil = 1.5
  let winT = 0, winN = 0, winCpu = 0
  let bad = 0, calm = 0
  let lastDegrade = -99
  let probeAt = PROBE_BASE
  let probeGap = PROBE_BASE
  let probedAt = -99
  let probeFrom = -1
  let probeTier: Tier | null = null // the (heavier) tier we came from while a tier probe is in flight
  let sinceReport = 0
  const lockedUntil: number[] = LEVELS.map(() => 0)
  const tierBlocked: Partial<Record<Tier, number>> = {}
  const ring = new Float32Array(RING)
  const scratch = new Float32Array(RING)
  let ringN = 0, ringI = 0
  const start = o.scale0 ?? 1
  let lvl = Math.max(0, LEVELS.findIndex((v) => v <= start + 1e-6))
  const stats: PerfStats = { ms: 16.7, fps: 60, dpr, scale: LEVELS[lvl], tier, p95: 16.7, p99: 16.7, worst: 16.7, hitches: 0, changes: 0, bound: '-', cpu: 0, events: [] }

  /** the lowest scale allowed: below it the effective pixel density (canvas dpr × scale) would fall under the tier's floor */
  const floorLevel = () => {
    const min = SETTINGS[tier].dprMin
    let f = 0
    for (let i = 0; i < LEVELS.length; i++) if (dpr * LEVELS[i] >= min - 0.02) f = i
    return f
  }

  const log = (msg: string) => {
    stats.events.push(`${t.toFixed(1)}s ${msg}`)
    if (stats.events.length > 8) stats.events.shift()
  }
  const publish = () => {
    stats.scale = LEVELS[lvl]
    stats.dpr = dpr
    stats.tier = tier
    stats.changes++
    o.apply(tier, dpr, LEVELS[lvl])
  }
  const setLevel = (nl: number, why: string) => {
    if (nl === lvl) return
    const from = LEVELS[lvl]
    lvl = nl
    bad = 0
    calm = 0
    graceUntil = t + 0.6
    log(`scale ${from.toFixed(2)}→${LEVELS[lvl].toFixed(2)} ${why}`)
    publish()
  }
  const setTier = (nt: Tier, why: string) => {
    const from = tier
    tier = nt
    dpr = Math.min(dpr, SETTINGS[nt].dprMax)
    bad = 0
    calm = 0
    graceUntil = t + 1.5 // buffers re-allocate + programs may recompile
    lvl = Math.min(lvl, floorLevel())
    log(`tier ${from}→${nt} ${why}`)
    publish()
  }

  const frameStats = () => {
    const n = ringN
    if (!n) return
    scratch.set(ring)
    const a = scratch.subarray(0, n).sort()
    stats.p95 = a[Math.min(n - 1, Math.floor(n * 0.95))]
    stats.p99 = a[Math.min(n - 1, Math.floor(n * 0.99))]
    stats.worst = a[n - 1]
  }

  const sample = (dt: number, cpuMs: number) => {
    const ms = dt * 1000
    if (dt > 0.05) stats.hitches++
    stats.ms += (ms - stats.ms) * 0.06
    stats.fps = 1000 / Math.max(1, stats.ms)
    stats.cpu += (cpuMs - stats.cpu) * 0.06
    ring[ringI] = ms
    ringI = (ringI + 1) % RING
    if (ringN < RING) ringN++
    if ((sinceReport += dt) >= 1) { sinceReport = 0; frameStats() }
  }

  return {
    stats,
    /** statistics only (developer-pinned tier: nothing is ever changed) */
    observe(dt: number, cpuMs = 0) {
      if (dt > 0.25) return
      sample(dt, cpuMs)
    },
    /** a scene change / tab return: ignore the next moments (shader compiles, texture uploads) */
    grace(sec = 1.5) {
      graceUntil = Math.max(graceUntil, t + sec)
      winT = 0
      winN = 0
      winCpu = 0
    },
    tick(dt: number, cpuMs = 0) {
      if (dt > 0.25) return // tab switch / debugger pause: not evidence about the device
      t += dt
      sample(dt, cpuMs)
      if (t < graceUntil) return
      winT += dt
      winN++
      winCpu += cpuMs
      if (winT < WINDOW) return
      const avg = (winT / winN) * 1000
      const cpu = winCpu / winN
      winT = 0
      winN = 0
      winCpu = 0
      const cpuBound = cpu > avg * CPU_BOUND
      stats.bound = avg > DEGRADE_MS ? (cpuBound ? 'cpu' : 'gpu') : '-'
      const idx = TIERS.indexOf(tier)
      const floor = floorLevel()

      if (avg > DEGRADE_MS) {
        calm = 0
        bad++
        const severe = avg > SEVERE_MS
        // a probe that starts to fail is undone after ONE bad window: its cost is a half-second blip, not a stutter
        const probing = (probeTier !== null || probeFrom >= 0) && t - probedAt < PROBE_FAIL_WITHIN
        if ((bad >= CONFIRM || severe || probing) && (t - lastDegrade >= DEGRADE_GAP || probing)) {
          lastDegrade = t
          // a probe that fails soon after: revert it and lock that level out (exponentially longer each time)
          if (probeTier && t - probedAt < PROBE_FAIL_WITHIN) {
            const back = probeTier
            tierBlocked[tier] = t + 180
            probeGap = Math.min(PROBE_GAP_MAX, probeGap * 2)
            probeAt = t + probeGap
            probeTier = null
            setTier(back, 'probe failed')
            return
          }
          if (probeFrom >= 0 && t - probedAt < PROBE_FAIL_WITHIN) {
            lockedUntil[probeFrom] = t + Math.min(300, probeGap * 2)
            probeGap = Math.min(PROBE_GAP_MAX, probeGap * 2)
            probeAt = t + probeGap
            probeFrom = -1
            setLevel(Math.min(floor, lvl + 1), 'probe failed')
            return
          }
          probeFrom = -1
          if (!cpuBound && lvl < floor) {
            // proportional: pixels cost ∝ scale², so scale' = scale·sqrt(budget/avg); at least one level, at most three
            const want = LEVELS[lvl] * Math.sqrt(BUDGET_MS / avg)
            let nl = lvl + 1
            while (nl < floor && LEVELS[nl] > want + 0.02) nl++
            setLevel(Math.min(floor, Math.min(lvl + 3, nl)), `${avg.toFixed(0)}ms gpu`)
          } else if (idx < TIERS.length - 1 && (cpuBound || lvl >= floor)) {
            const nt = TIERS[idx + 1]
            setTier(nt, `${avg.toFixed(0)}ms ${cpuBound ? 'cpu' : 'gpu@floor'}`)
          } else bad = 0 // nothing left to give: a stable lower frame rate beats flapping
        }
      } else if (avg <= RESTORE_MS) {
        bad = 0
        calm += WINDOW
        if (calm >= probeAt && t - lastDegrade >= PROBE_BASE) {
          if (lvl > 0 && lockedUntil[lvl - 1] <= t) {
            probeFrom = lvl - 1
            probedAt = t
            probeAt = t + probeGap
            setLevel(lvl - 1, 'probe')
          } else if (lvl === 0 && idx > ceilIdx && (tierBlocked[TIERS[idx - 1]] ?? 0) <= t) {
            const nt = TIERS[idx - 1]
            probedAt = t
            probeAt = t + probeGap
            probeTier = tier
            setTier(nt, 'probe')
          } else calm = 0
        }
      } else {
        // in between (17.6–19.5 ms): hold, forget partial streaks
        bad = Math.max(0, bad - 1)
        calm = Math.max(0, calm - WINDOW)
      }
      // a probe that survived long enough is accepted: next probe may come sooner
      if ((probeFrom >= 0 || probeTier) && t - probedAt >= PROBE_FAIL_WITHIN) {
        probeFrom = -1
        probeTier = null
        probeGap = Math.max(PROBE_BASE, probeGap * 0.75)
      }
    },
  }
}
