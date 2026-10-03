// Re-encodes the OFFICIAL covers (no redraw / no edits — resize + format only).
// Source files live in public/covers/*-official.jpeg ; outputs are WebP + AVIF.
import sharp from 'sharp'
import { existsSync } from 'node:fs'

const jobs = [
  { src: 'public/covers/alterco-official.jpeg', out: 'public/covers/alterco', size: 1144 },
  { src: 'public/covers/dualismo-official.jpeg', out: 'public/covers/dualismo', size: 493 },
]
for (const j of jobs) {
  if (!existsSync(j.src)) { console.warn('missing', j.src); continue }
  const img = sharp(j.src)
  await img.clone().webp({ quality: 92 }).toFile(`${j.out}.webp`)
  await img.clone().avif({ quality: 70 }).toFile(`${j.out}.avif`)
  // small preview used for tiny UI chips / OG
  await img.clone().resize(256, 256).webp({ quality: 85 }).toFile(`${j.out}-256.webp`)
  console.log('ok', j.out)
}
