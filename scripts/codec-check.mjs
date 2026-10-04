// does this browser build decode the room's H.264/AAC mp4? (stock Playwright Chromium has no proprietary codecs)
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.goto('http://localhost:3000/robots.txt').catch(() => {})
console.log(await p.evaluate(() => { const v = document.createElement('video'); return { h264: v.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"'), mp4: v.canPlayType('video/mp4'), webm: v.canPlayType('video/webm; codecs="vp9"') } }))
await b.close()
