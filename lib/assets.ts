import * as THREE from 'three'
import { alterco, dualismo, pad, trackLabel } from '@/data/project'
import { nextFrame, track } from './paint'
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
  creditsPoster: THREE.Texture
  portalPaper: THREE.Texture
  pieces: THREE.Texture[]
  letters: THREE.Texture[]
  signs: Record<string, THREE.Texture>
  stencils: Record<string, THREE.Texture>
  cards: THREE.Texture[]
  skyline: T.SkylineLayer[]
  roofDeck: THREE.Texture
  tower: { map: THREE.Texture; emissive: THREE.Texture }
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
        A.pieces = [
          T.pieceTexture('HOOD', { a: '#27b7b0', b: '#a6f0e0', c: '#2a3a8c' }, 31),
          T.pieceTexture('KOLD', { a: '#ff5d8f', b: '#ffc0cf', c: '#5a2a7a' }, 32),
          T.pieceTexture('VERT', { a: '#f2c230', b: '#fff0a0', c: '#b3261e' }, 33),
          T.pieceTexture('NYX', { a: '#ffffff', b: '#bfd8ff', c: '#1a1a22' }, 34),
          T.pieceTexture('ECHO', { a: '#7be05a', b: '#d8ffb0', c: '#143a2a' }, 35),
        ]
        // seven hidden letters — the scavenger hunt that spells ALTERCO
        const cols = ['#ff5d8f', '#27b7b0', '#f2c230', '#ffffff', '#ff7a3a', '#7aa8ff', '#e03030']
        A.letters = 'ALTERCO'.split('').map((ch, i) =>
          T.tagTexture({ text: ch, w: 256, h: 256, fill: cols[i], outline: '#f2eee6', shadow: '#0c0c10', skew: -0.12, rot: (i % 2 ? 4 : -5), seed: 60 + i, drips: 2 }),
        )
      }],
      ['posters', 9, () => {
        const looks = [
          { bg: '#d8d1c0', fg: '#121212', accent: '#c8362a' },
          { bg: '#121214', fg: '#ece6d8', accent: '#e8c548' },
          { bg: '#c8362a', fg: '#14100e', accent: '#f2e8d0' },
          { bg: '#e2dccb', fg: '#14161c', accent: '#2a5ac8' },
        ]
        A.posters = alterco.tracks.map((tr, i) => {
          const lines = split(tr.title.replace(/è/gi, 'È'))
          return T.posterTexture({ lines, sub: `TRACK ${pad(tr.n)} / ALTERCO${tr.tag ? ' · ' + tr.tag.toUpperCase() : ''}`, seed: 40 + i, halftone: i % 2 === 0, ...looks[i % looks.length] })
        })
        A.posters.push(T.posterTexture({ lines: ['HOOD', 'DINO'], sub: 'ALTERCO — 7 TRACKS', seed: 55, halftone: true, bg: '#d8d1c0', fg: '#121212', accent: '#c8362a' }))
        A.creditsPoster = T.posterTexture({ lines: ['READ', 'THE', 'SMALL', 'PRINT'], sub: 'WHO MADE THE SOUND', seed: 57, bg: '#1a1a1c', fg: '#e8e0cc', accent: '#9a9a9a', w: 384, h: 512 })
        A.portalPaper = T.portalPaperTexture()
        A.signs = {
          alterco: T.signTexture({ text: 'ALTERCO', small: 'HOODDINO · 7 TRACKS', bg: '#151e33', fg: '#f4ead2', border: '#e9a15a', seed: 8, w: 512, h: 256 }),
          tracks: T.signTexture({ text: '01 — 07', small: 'TRACKS →', bg: '#1a1a1a', fg: '#f4ead2', border: '#f4ead2', seed: 9 }),
          oneWay: T.signTexture({ text: 'ONE WAY', arrow: 'right', bg: '#111', fg: '#f2f2f2', border: '#f2f2f2', seed: 10, w: 512, h: 160 }),
          roof: T.signTexture({ text: 'ROOF ACCESS', arrow: 'up', bg: '#8c2a22', fg: '#f4ead2', border: '#f4ead2', seed: 11, w: 512, h: 192 }),
          listen: T.signTexture({ text: 'LISTEN', small: 'ROOFTOP', bg: '#101a2c', fg: '#f4ead2', border: '#9ab6ff', seed: 12 }),
        }
        A.stencils = {
          five: T.stencilTexture('05'), seven: T.stencilTexture('07'),
        }
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
  await nextFrame()
  A.tower = T.towerTextures()
  await nextFrame()
  A.roofPieces = [
    T.pieceTexture('SKRT', { a: '#ff7a3a', b: '#ffd0a0', c: '#2a2a8c' }, 71, 1024, 512),
    T.pieceTexture('RAW', { a: '#4ac8ff', b: '#d0f0ff', c: '#6a1a5a' }, 72, 1024, 512),
    T.pieceTexture('JADE', { a: '#4be0a0', b: '#d0ffe8', c: '#1a2a4a' }, 73, 1024, 512),
    T.pieceTexture('MOSS', { a: '#f4efe6', b: '#ffffff', c: '#22222c' }, 74, 1024, 512),
  ]
  A.roofReady = true
}

export async function loadDualism() {
  if (A.dualReady) return
  A.dualLabels = dualismo.tracks.map((tr) => T.ringLabelTexture(tr.title.toUpperCase(), pad(tr.n)))
  A.returnLabel = T.ringLabelTexture('RETURN TO ALTERCO')
  A.dualReady = true
}
