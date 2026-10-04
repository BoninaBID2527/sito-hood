// time from navigation to the ENTER screen (CPU-bound texture generation dominates; software GL, relative numbers only)
import { chromium } from 'playwright-core'
const [port = '3000', quality = 'high', n = '2'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const out = []
for (let i = 0; i < Number(n); i++) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
  const t0 = Date.now()
  await page.goto(`http://localhost:${port}/?quality=${quality}`)
  await page.waitForSelector('button:has-text("ENTER")', { timeout: 300000 })
  out.push(Date.now() - t0)
  await page.close()
}
console.log(`port ${port} ${quality}: ENTER screen after ${out.map((v) => (v / 1000).toFixed(1) + 's').join(', ')}`)
await browser.close()
