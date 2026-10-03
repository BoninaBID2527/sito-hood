import { useStore } from './store'

/**
 * Local-only memory of what the visitor has found. Nothing is sent anywhere; no accounts, no analytics.
 * Reset (development / support): add `?reset=1` to the URL, or call `window.__hd.reset()` in a `?debug` session.
 */
const KEY = { nums: 'hd:nums', found: 'hd:dualismo', ret: 'hd:dualret' } as const

const read = (k: string): string | null => {
  try { return localStorage.getItem(k) } catch { return null }
}
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v) } catch { /* private mode / blocked storage: the session still works */ }
}

export function loadSecrets() {
  if (typeof window === 'undefined') return
  if (new URLSearchParams(window.location.search).has('reset')) resetSecrets(false)
  let nums = new Array(7).fill(false)
  try {
    const raw = read(KEY.nums)
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) nums = nums.map((_, i) => !!a[i]) }
  } catch { /* corrupt entry → start fresh */ }
  useStore.getState().set({ nums, dualismoFound: read(KEY.found) === '1', dualReturned: read(KEY.ret) === '1' })
}
export const saveNums = (nums: boolean[]) => write(KEY.nums, JSON.stringify(nums))
export const saveFound = () => write(KEY.found, '1')
export const saveReturned = () => write(KEY.ret, '1')

export function resetSecrets(applyToStore = true) {
  try { Object.values(KEY).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
  if (applyToStore) useStore.getState().set({ nums: new Array(7).fill(false), dualismoFound: false, dualReturned: false, eggs: [], letters: new Array(7).fill(false) })
}
