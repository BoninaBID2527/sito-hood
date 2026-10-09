// Read-only production smoke, executed from the repository root.
import { chromium } from '../../../scripts/browser.mjs'
import { writeFileSync } from 'node:fs'
const url = 'https://boninabid2527.github.io/sito-hood/'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
const errors = [], failed = [], assets = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/KHR_parallel|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()) })
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure() }))
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); if (['image', 'font', 'media'].includes(r.request().resourceType())) assets.push({ url: r.url(), status: r.status() }) })
try {
  const response = await page.goto(url)
  await page.waitForSelector('button:has-text("ENTER")', { timeout: 600000 })
  await page.click('button:has-text("ENTER")', { force: true })
  await page.waitForSelector('canvas', { state: 'visible', timeout: 600000 })
  await page.waitForSelector('button:has-text("ENTER")', { state: 'hidden', timeout: 600000 })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/v38/baseline/public-smoke.png', timeout: 240000 })
  // Use the browser's configured network path; a separate APIRequestContext
  // does not inherit the environment's proxy routing.
  const video = await page.evaluate(async () => {
    const r = await fetch('room/hooddino-studio-arrangiamento.mp4')
    const body = await r.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', body)
    const sha256 = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
    return { status: r.status, mime: r.headers.get('content-type'), bytes: body.byteLength, sha256 }
  })
  const result = { checkedAt: new Date().toISOString(), url, status: response.status(), browser: browser.version(), canvas: await page.locator('canvas').count(), selectedAssets: assets, video, errors, failed, limits: 'Opening-scene smoke only; no native-video decode, iOS or device performance claim.' }
  writeFileSync('qa/v38/baseline/public-smoke.json', JSON.stringify(result, null, 2))
  if (result.status !== 200 || !result.canvas || errors.length || failed.length || result.video.status !== 200 || result.video.bytes !== 4860666 || result.video.sha256 !== '02def5f45a5b97d770fd995f47193e4ec21865b941366719bebf6d43208d7949') throw new Error(JSON.stringify(result))
  console.log('Public smoke PASS:', assets.length, 'image/font/media responses; authentic packaged video HTTP 200.')
} finally { await browser.close() }
