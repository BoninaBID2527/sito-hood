import { SETTINGS, TIERS, type Tier } from './quality'

/**
 * Runtime quality adaptation.
 *
 * Philosophy: spend GPU/CPU only where it is perceived, and never flap.
 *  · decisions use 1-second window averages (never a single dropped frame) and need several bad windows in a row
 *  · first the cheapest, least visible lever (DPR), then the tier (secondary effects: reflections cadence, particles, haze, MSAA …)
 *  · restoring is slower than degrading, needs a long calm stretch, and a tier that failed after a restore is blocked for a while
 *  · scene changes (alley → roof → DUALISMO) and tab switches get a grace period
 */
export interface AdaptiveOpts {
  start: Tier
  /** best tier we are allowed to climb back to (the device's initial tier) */
  ceiling: Tier
  /** initial DPR (already clamped to the tier) */
  dpr: number
  apply: (tier: Tier, dpr: number) => void
}

export interface PerfStats {
  /** smoothed frame time in ms (EMA) and fps derived from it */
  ms: number
  fps: number
  dpr: number
  tier: Tier
  /** frames longer than 50 ms since start */
  hitches: number
  /** how many times the manager changed something */
  changes: number
}

const DEGRADE_MS = 24 // sustained avg slower than this (≈ < 42 fps) → reduce
const RESTORE_MS = 18.2 // sustained avg at/under this (≈ locked 60 fps) → may restore
const BAD_WINDOWS = 3
const GOOD_WINDOWS = 8
const DEGRADE_GAP = 4 // s between two reductions
const RESTORE_GAP = 12 // s between two restorations
const FAILED_BLOCK = 90 // s a tier stays blocked after failing soon after a restore
const DPR_DOWN = 0.15
const DPR_UP = 0.1

export function createAdaptive(o: AdaptiveOpts) {
  let tier = o.start
  let dpr = o.dpr
  const ceilIdx = TIERS.indexOf(o.ceiling)
  let t = 0 // seconds since creation
  let graceUntil = 3
  let winT = 0, winN = 0
  let bad = 0, good = 0
  let lastDegrade = -99, lastRestore = -99
  let restoredAt = -99
  let goodNeeded = GOOD_WINDOWS
  const blocked: Partial<Record<Tier, number>> = {}
  const stats: PerfStats = { ms: 16.7, fps: 60, dpr, tier, hitches: 0, changes: 0 }

  const set = (nt: Tier, nd: number) => {
    tier = nt
    dpr = Math.round(nd * 100) / 100
    stats.tier = tier
    stats.dpr = dpr
    stats.changes++
    bad = 0
    good = 0
    graceUntil = t + 2
    o.apply(tier, dpr)
  }

  return {
    stats,
    /** statistics only (developer-pinned tier: nothing is ever changed) */
    observe(dt: number) {
      if (dt > 0.25) return
      if (dt > 0.05) stats.hitches++
      stats.ms += (dt * 1000 - stats.ms) * 0.06
      stats.fps = 1000 / Math.max(1, stats.ms)
    },
    /** a scene change / tab return: ignore the next moments (shader compiles, texture uploads) */
    grace(sec = 2.5) {
      graceUntil = Math.max(graceUntil, t + sec)
      winT = 0
      winN = 0
    },
    tick(dt: number) {
      if (dt > 0.25) return // tab switch / debugger pause: not evidence about the device
      t += dt
      if (dt > 0.05) stats.hitches++
      stats.ms += (dt * 1000 - stats.ms) * 0.06
      stats.fps = 1000 / Math.max(1, stats.ms)
      if (t < graceUntil) return
      winT += dt
      winN++
      if (winT < 1) return
      const avg = (winT / winN) * 1000
      winT = 0
      winN = 0
      const q = SETTINGS[tier]
      const idx = TIERS.indexOf(tier)
      if (avg > DEGRADE_MS) {
        good = 0
        bad++
        if (bad >= BAD_WINDOWS && t - lastDegrade >= DEGRADE_GAP) {
          lastDegrade = t
          // a restore that fails soon after is a sign that tier is too heavy right now: block it and be more patient next time
          if (t - restoredAt < 25) {
            blocked[tier] = t + FAILED_BLOCK
            goodNeeded = Math.min(24, goodNeeded * 1.5)
          }
          if (dpr > q.dprMin + 0.04) set(tier, Math.max(q.dprMin, dpr - DPR_DOWN))
          else if (idx < TIERS.length - 1) {
            const nt = TIERS[idx + 1]
            set(nt, Math.min(dpr, SETTINGS[nt].dprMax))
          } else bad = 0
        }
      } else if (avg <= RESTORE_MS) {
        bad = 0
        good++
        if (good >= goodNeeded && t - lastRestore >= RESTORE_GAP && t - lastDegrade >= RESTORE_GAP) {
          if (dpr < q.dprMax - 0.04) {
            lastRestore = t
            restoredAt = t
            set(tier, Math.min(q.dprMax, dpr + DPR_UP))
          } else if (idx > ceilIdx) {
            const nt = TIERS[idx - 1]
            if ((blocked[nt] ?? 0) <= t) {
              lastRestore = t
              restoredAt = t
              set(nt, Math.min(dpr, SETTINGS[nt].dprMax))
            } else good = 0
          } else good = 0
        }
      } else {
        // in between: hold, forget partial streaks slowly
        bad = Math.max(0, bad - 1)
        good = Math.max(0, good - 1)
      }
    },
  }
}
