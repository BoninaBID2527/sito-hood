/** Base path for static hosting under a sub-path (e.g. GitHub Pages project sites). Empty in normal builds. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
export const withBase = (p: string) => (p.startsWith('/') ? BASE + p : p)
