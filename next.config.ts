import type { NextConfig } from 'next'

/**
 * Normal builds (`npm run build` / `next start`) are untouched.
 * Static preview build (GitHub Pages etc.): `STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/repo-name npm run build` → ./.next-export
 */
const exp = process.env.STATIC_EXPORT === '1'
const base = process.env.NEXT_PUBLIC_BASE_PATH || ''

const config: NextConfig = {
  reactStrictMode: false, // R3F + GSAP: avoid double-mounted WebGL contexts in dev
  poweredByHeader: false,
  transpilePackages: ['three'],
  ...(base ? { basePath: base } : {}),
  ...(exp
    ? { output: 'export' as const, trailingSlash: true, distDir: '.next-export', images: { unoptimized: true } }
    : { images: { formats: ['image/avif', 'image/webp'] as ('image/avif' | 'image/webp')[] } }),
}
export default config
