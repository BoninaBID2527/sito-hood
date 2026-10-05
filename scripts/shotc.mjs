// client for scripts/shotd.mjs: node scripts/shotc.mjs '<json steps>' [dir]   (prints the daemon's log)
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs'
const [steps, dir = process.env.DIR || 'shots-d'] = process.argv.slice(2)
const done = `${dir}/done.json`
if (existsSync(done)) unlinkSync(done)
writeFileSync(`${dir}/cmd.json`, steps)
const t0 = Date.now()
while (!existsSync(done)) { await new Promise((r) => setTimeout(r, 400)); if (Date.now() - t0 > (Number(process.env.TIMEOUT) || 100) * 1000) { console.log('(still running — poll again with: cat ' + done + ')'); process.exit(0) } }
console.log(JSON.parse(readFileSync(done, 'utf8')).join('\n'))
