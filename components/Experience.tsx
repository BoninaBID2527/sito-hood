'use client'

import dynamic from 'next/dynamic'

// The whole WebGL world is client-only and code-split from the semantic shell.
const App = dynamic(() => import('./App'), { ssr: false })

export default function Experience() {
  return <App />
}
