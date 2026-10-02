import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: false, // R3F + GSAP: avoid double-mounted WebGL contexts in dev
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  transpilePackages: ['three'],
}
export default config
