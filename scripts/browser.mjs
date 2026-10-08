import { chromium as engine } from 'playwright-core'
import { existsSync } from 'node:fs'

// Reuse a launchServer connection for long software-GL QA runs, while keeping
// each suite's isolated browser contexts. Closing a connected client disconnects
// it; the server remains available for the next suite.
export const chromium = {
  async launch(options) {
    const executablePath = process.env.CHROME || (existsSync(options.executablePath) ? options.executablePath : '/usr/bin/chromium')
    const browser = process.env.BROWSER_WS_ENDPOINT
      ? await engine.connect(process.env.BROWSER_WS_ENDPOINT)
      : await engine.launch({ ...options, executablePath })
    // Optional render-scale overrides apply only to local QA URLs. Test inputs,
    // simulation timing and all production rendering remain unchanged.
    if (process.env.EXTRA) {
      const createContext = browser.newContext.bind(browser)
      browser.newContext = async (...args) => {
        const context = await createContext(...args)
        const createPage = context.newPage.bind(context)
        context.newPage = async (...pageArgs) => {
          const page = await createPage(...pageArgs)
          const goto = page.goto.bind(page)
          page.goto = (address, ...gotoArgs) => {
            const url = new URL(address)
            if (['localhost', '127.0.0.1'].includes(url.hostname)) {
              for (const [key, value] of new URLSearchParams(process.env.EXTRA.replace(/^&/, ''))) {
                if (!url.searchParams.has(key)) url.searchParams.set(key, value)
              }
            }
            return goto(url.href, ...gotoArgs)
          }
          return page
        }
        return context
      }
    }
    return browser
  },
}
