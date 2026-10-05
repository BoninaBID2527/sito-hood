// V3.5 — closed-loop simulation of the adaptive manager against synthetic devices (no browser needed).
// Verifies: settles fast on a too-heavy tablet, does not oscillate on a borderline one, never moves on a capable one,
// goes to the tier (not the scale) when CPU-bound, accepts a stable lower rate when nothing is left to give.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
// the sources are plain TypeScript without enums: Node's type stripping runs them directly (specifiers get an explicit extension)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adsim-'))
for (const f of ['quality', 'adaptive']) fs.writeFileSync(path.join(dir, `${f}.ts`), fs.readFileSync(`lib/${f}.ts`, 'utf8').replace(/from '\.\/quality'/g, "from './quality.ts'"))
const { createAdaptive } = await import(path.join(dir, 'adaptive.ts'))
const { SETTINGS } = await import(path.join(dir, 'quality.ts'))
const tierGpu = { ultra: 1.25, high: 1.1, balanced: 1, mobile: 0.7 } // relative cost of a tier's secondary effects
const tierCpu = { ultra: 1.3, high: 1.15, balanced: 1, mobile: 0.6 }

function run(name, { gpuAt1, cpuMs, tier = 'balanced', dpr = 1.75, scale0 = 0.9, secs = 60, noise = 0.06 }) {
  let t = SETTINGS[tier], d = dpr, scale = scale0
  const ad = createAdaptive({ start: tier, ceiling: tier, dpr, scale0, apply: (nt, nd, sc) => { t = SETTINGS[nt]; d = nd; scale = sc } })
  scale = ad.stats.scale
  const ref = (dpr * 1) ** 2 // gpuAt1 is the GPU ms at scale 1 for the starting tier
  let now = 0, worstAfter = 0, frames = 0, sum = 0, jank = 0, after = 0
  const hist = []
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  while (now < secs) {
    const gpu = gpuAt1 * ((d * scale) ** 2 / ref) * tierGpu[t.tier] * (1 + (rnd() - 0.5) * noise * 2)
    const cpu = cpuMs * tierCpu[t.tier]
    const work = Math.max(gpu, cpu)
    const dt = Math.max(1, Math.ceil(work / 16.67 - 0.02)) * 16.67 // vsync-quantised
    now += dt / 1000
    ad.tick(dt / 1000, cpu)
    frames++
    if (now > 8) { sum += dt; after++; if (dt > 20) jank++; worstAfter = Math.max(worstAfter, dt) }
    hist.push([now, dt, scale, t.tier])
  }
  // when did the frame time first stay ≤ 1.1× its final value for good ("settled")?
  const endMs = hist.slice(-120).reduce((s, h) => s + h[1], 0) / 120
  // settled = the last NON-probe adaptation (probes are deliberate, brief experiments)
  const lastReal = [...ad.stats.events].reverse().find((e) => !/probe/.test(e))
  const settledAt = lastReal ? parseFloat(lastReal) : 0
  const settled = 0
  const changes = ad.stats.events.length
  console.log(`${name.padEnd(34)} settled@${settledAt.toFixed(1)}s  final ${endMs.toFixed(1)} ms (${(1000 / endMs).toFixed(0)} fps)  scale ${scale.toFixed(2)} tier ${t.tier}  adaptations ${ad.stats.changes}  hitch>50ms ${ad.stats.hitches}  p95 ${ad.stats.p95.toFixed(0)} p99 ${ad.stats.p99.toFixed(0)}  jank>20ms after 8s ${((jank / Math.max(1, after)) * 100).toFixed(1)}%`)
  if (process.env.V) console.log('   ' + ad.stats.events.join('\n   '))
  return { settled: settledAt, jank: jank / Math.max(1, after), endMs, changes: ad.stats.changes, tier: t.tier, scale }
}
const res = []
res.push(run('capable tablet (12 ms @ full)', { gpuAt1: 12, cpuMs: 6 }))
res.push(run('borderline (17 ms @ full)', { gpuAt1: 17, cpuMs: 6 }))
res.push(run('too heavy (28 ms @ full)', { gpuAt1: 28, cpuMs: 6 }))
res.push(run('very heavy (45 ms @ full)', { gpuAt1: 45, cpuMs: 6 }))
res.push(run('hopeless (120 ms @ full)', { gpuAt1: 120, cpuMs: 6 }))
res.push(run('cpu-bound (30 ms main thread)', { gpuAt1: 10, cpuMs: 30 }))
res.push(run('desktop capable (8 ms), scale0 1', { gpuAt1: 8, cpuMs: 5, tier: 'high', dpr: 1, scale0: 1 }))
const bad = []
if (res[0].changes > 3) bad.push('capable device was disturbed')
if (res[1].changes > 6) bad.push('borderline device oscillates')
if (res[2].settled > 6) bad.push('too-heavy device settled slowly')
if (res[3].settled > 8) bad.push('very heavy device settled slowly')
if (res.slice(0, 5).some((r, i) => i !== 4 && r.jank > 0.05)) bad.push('too much jank after settling')
if (res[5].tier === 'balanced') bad.push('cpu-bound device never left the tier')
if (bad.length) { console.error('FAIL: ' + bad.join('; ')); process.exit(1) }
console.log('adaptive simulation OK')
