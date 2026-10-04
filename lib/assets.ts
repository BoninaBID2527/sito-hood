import * as THREE from 'three'
import { alterco, dualismo, pad, trackLabel } from '@/data/project'
import { makeCanvas, nextFrame, toTexture, track } from './paint'
import { rt } from './runtime'
import { applyAge, drawBigPoster, drawHand } from './graffiti'
import { buildGraffiti } from './graffitiSheet'
import * as T from './textures'

/**
 * Asset registry. Phase 1 (`loadCore`) blocks the loader screen and is deliberately small:
 * fonts, both official covers and the alley textures. Phase 2 (`loadRoof`, `loadDualism`)
 * is generated lazily after the user has entered.
 */
export interface Assets {
  coreReady: boolean
  roofReady: boolean
  dualReady: boolean
  covers: { alterco: THREE.Texture; dualismo: THREE.Texture }
  brick: Record<'red' | 'dark' | 'weathered' | 'plaster' | 'concrete', T.BrickSet>
  asphalt: THREE.Texture
  sidewalk: THREE.Texture
  puddle: THREE.Texture
  roofWet: THREE.Texture
  windows: ReturnType<typeof T.windowTextures>
  grating: THREE.Texture
  shutters: THREE.Texture[]
  doors: THREE.Texture[]
  fan: THREE.Texture
  glow: THREE.Texture
  dot: THREE.Texture
  banner: THREE.Texture
  projection: THREE.Texture
  posters: THREE.Texture[]
  /** atlases for all street typography (spray + paper) */
  graf: import('./graffitiSheet').Graffiti
  creditsPoster: THREE.Texture
  portalPaper: THREE.Texture
  pieces: THREE.Texture[]
  letters: THREE.Texture[]
  signs: Record<string, THREE.Texture>
  stencils: Record<string, THREE.Texture>
  cards: THREE.Texture[]
  skyline: T.SkylineLayer[]
  roofDeck: THREE.Texture
  roofPieces: THREE.Texture[]
  dualLabels: THREE.Texture[]
  returnLabel: THREE.Texture
}

export const A = {} as Assets
A.coreReady = false
A.roofReady = false
A.dualReady = false

const loader = new THREE.TextureLoader()
const loadTex = (url: string) =>
  new Promise<THREE.Texture>((res, rej) =>
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      track(t)
      res(t)
    }, undefined, rej),
  )

type Step = [string, number, () => void | Promise<void>]

async function run(steps: Step[], onProgress: (p: number) => void) {
  const total = steps.reduce((a, s) => a + s[1], 0)
  let done = 0
  for (const [, w, fn] of steps) {
    await fn()
    done += w
    onProgress(done / total)
    await nextFrame() // let the loader paint between heavy canvas jobs
  }
}

const fontsReady = async () => {
  const f = document.fonts
  await Promise.all([
    f.load('400 120px Anton'),
    f.load('400 20px "Space Mono"'),
    f.load('700 20px "Space Mono"'),
    // street typography families (see lib/graffiti.ts)
    ...['"Permanent Marker"', '"Reenie Beanie"', '"Rock Salt"', '"Titan One"', '"Bungee"', '"Saira Stencil One"', '"Nanum Pen Script"'].map((n) => f.load(`400 64px ${n}`)),
    f.load('italic 900 64px "Playfair Display"'),
  ]).catch(() => undefined)
  await f.ready
}

export async function loadCore(onProgress: (p: number) => void) {
  if (A.coreReady) return
  const split = (s: string) => s.toUpperCase().split(' ')
  await run(
    [
      ['fonts', 6, fontsReady],
      ['alterco', 10, async () => { A.covers = { alterco: await loadTex(alterco.artwork.webp), dualismo: null as any } }],
      ['dualismo', 3, async () => { A.covers.dualismo = await loadTex(dualismo.artwork.webp) }],
      ['brick', 14, () => {
        A.brick = {
          red: T.brickSet('red', 11), dark: T.brickSet('dark', 12), weathered: T.brickSet('weathered', 13),
          plaster: T.brickSet('plaster', 14), concrete: T.brickSet('concrete', 15),
        }
      }],
      ['ground', 9, () => {
        A.asphalt = T.asphaltTexture(21)
        A.sidewalk = T.sidewalkTexture(22)
        A.puddle = T.puddleMask({ halfW: 14, zNear: 20, zFar: -122, pool: { x: 0, z: -94, r: 3.6 } })
      }],
      ['facade', 8, () => {
        A.windows = T.windowTextures()
        A.grating = T.gratingTexture()
        A.shutters = [T.shutterTexture(1, '#5a5f58'), T.shutterTexture(2, '#6a5a4c'), T.shutterTexture(3, '#4a5560')]
        A.doors = [T.metalDoorTexture(1, '#43484a'), T.metalDoorTexture(2, '#5a3a32'), T.metalDoorTexture(3, '#2f4a44')]
        A.fan = T.fanTexture()
        A.glow = T.glowTexture()
        A.dot = T.softDotTexture()
        A.skyline = [T.skylineTextures(101, 1, 0.5), T.skylineTextures(102, 0.8, 0.7), T.skylineTextures(103, 1.2, 0.9)]
      }],
      ['graffiti', 14, () => {
        A.banner = T.bannerTexture('HOODDINO')
        A.projection = T.projectionTexture('ALTERCO')
        // every wall piece, poster and sticker lives in two atlases (lib/graffitiSheet.ts)
        A.graf = buildGraffiti(rt.quality.atlas)
        A.pieces = []
        // seven hidden letters — the scavenger hunt that spells ALTERCO, each by a different hand
        const hands = [
          { face: 'marker', color: '#ff5d8f' }, { face: 'beanie', color: '#27b7b0' }, { face: 'salt', color: '#f2c230' }, { face: 'marker', color: '#f4efe6' },
          { face: 'beanie', color: '#ff7a3a' }, { face: 'salt', color: '#7aa8ff' }, { face: 'marker', color: '#e03030' },
        ] as const
        A.letters = 'ALTERCO'.split('').map((ch, i) => {
          const { canvas, ctx } = makeCanvas(256, 256)
          drawHand(ctx, 256, 256, { text: ch, face: hands[i].face, color: hands[i].color, outline: i % 2 ? '#111114' : undefined, seed: 60 + i, slant: 0.2 + 0.05 * i, drips: 2, underline: false, rot: (i % 2 ? 0.07 : -0.09) })
          applyAge(ctx, 256, 256, { fade: 0.06 + 0.05 * i * 0.3, erase: i === 3 ? 0.3 : 0.08, seed: 300 + i })
          return toTexture(canvas, { aniso: 4 })
        })
      }],
      ['posters', 9, () => {
        A.posters = []
        A.creditsPoster = (() => {
          const { canvas, ctx } = makeCanvas(384, 512)
          drawBigPoster(ctx, 384, 512, { lines: ['READ', 'THE', 'SMALL', 'PRINT'], sub: 'WHO MADE THE SOUND', seed: 57, pal: 1 })
          return toTexture(canvas, { aniso: 4 })
        })()
        A.portalPaper = T.portalPaperTexture()
        A.signs = {
          alterco: T.signTexture({ text: 'ALTERCO', small: 'HOODDINO · 7 TRACKS', bg: '#151e33', fg: '#f4ead2', border: '#e9a15a', seed: 8, w: 512, h: 256 }),
          tracks: T.signTexture({ text: '01 — 07', small: 'TRACKS →', bg: '#1a1a1a', fg: '#f4ead2', border: '#f4ead2', seed: 9 }),
          oneWay: T.signTexture({ text: 'ONE WAY', arrow: 'right', bg: '#111', fg: '#f2f2f2', border: '#f2f2f2', seed: 10, w: 512, h: 160 }),
          roof: T.signTexture({ text: 'ROOF ACCESS', arrow: 'up', bg: '#8c2a22', fg: '#f4ead2', border: '#f4ead2', seed: 11, w: 512, h: 192 }),
          osteria: T.signTexture({ text: 'OSTERIA', small: 'CUCINA · VINO', bg: '#6d1d19', fg: '#efdfbf', border: '#d8b46a', seed: 13, w: 512, h: 384 }),
          farmacia: T.signTexture({ text: 'FARMACIA', small: 'NOTTE', bg: '#173f31', fg: '#e6f1e0', border: '#9fd6b4', seed: 14, w: 512, h: 384 }),
          neonPizza: T.neonTexture('PIZZA', '#ff9a3c'),
          neonOpen: T.neonTexture('OPEN', '#ff3b52', 384, 160),
          neonNotte: T.neonTexture('NOTTE', '#5ab8ff', 512, 192),
          listen: T.signTexture({ text: 'LISTEN', small: 'ROOFTOP', bg: '#101a2c', fg: '#f4ead2', border: '#9ab6ff', seed: 12 }),
        }
        A.stencils = {}
      }],
    ],
    onProgress,
  )
  A.coreReady = true
}

/** Seven poster-cards for the orbit — needs the cover image, so built right after core. */
export async function buildCards() {
  if (A.cards) return
  const img = A.covers.alterco.image as HTMLImageElement
  A.cards = alterco.tracks.map((tr, i) =>
    T.trackCardTexture({
      n: tr.n, total: alterco.tracks.length, title: tr.title, tag: tr.tag, cover: img,
      coverW: img.width, coverH: img.height, project: alterco.title, artist: 'HOODDINO', tone: i,
    }),
  )
  void trackLabel
}

export async function loadRoof() {
  if (A.roofReady) return
  A.roofDeck = T.roofDeckTexture(14)
  A.roofWet = T.puddleMask({ halfW: 13, zNear: 12, zFar: -24, pool: { x: 2, z: -12, r: 3.0 }, layout: 'roof' })
  await nextFrame()
  A.roofPieces = []
  A.roofReady = true
}

export async function loadDualism() {
  if (A.dualReady) return
  A.dualLabels = dualismo.tracks.map((tr) => T.ringLabelTexture(tr.title.toUpperCase(), pad(tr.n)))
  A.returnLabel = T.ringLabelTexture('RETURN TO ALTERCO')
  A.dualReady = true
}
