import * as THREE from 'three'
import { alterco } from '@/data/project'
import {
  Atlas, type Age, type Cell, type Spec,
  applyAge, drawBigPoster, drawHand, drawNote, drawStencil, drawSticker, drawSymbol, drawThrow, drawTrackPoster, drawUV, drawGlyph, drawWild, drawBlock,
  paper, scrap, FONT,
} from './graffiti'
import { rng } from './math'
import { grain } from './paint'

/**
 * The authored contents of the two street atlases. Every entry is a *different hand*:
 * its own family, palette and history (fresh / weathered / almost erased / painted over / crossed out / half covered).
 */
export interface Graffiti {
  spray: Atlas
  paper: Atlas
  sprayTex: THREE.Texture
  paperTex: THREE.Texture
  spr: Record<string, Cell>
  pap: Record<string, Cell>
}

const COVER = ['#4d443d', '#3e3935', '#5b4a41', '#46403b']

export function buildGraffiti(sc: number): Graffiti {
  const spray = new Atlas(2048, 3072, sc)
  const paperA = new Atlas(2048, 2048, sc)
  const S: Spec[] = []
  const P: Spec[] = []
  const add = (list: Spec[], id: string, w: number, h: number, draw: Spec['draw'], age?: Age) =>
    list.push({ id, w, h, draw: (c, ww, hh) => { draw(c, ww, hh); if (age) applyAge(c, ww, hh, age) } })

  /* 04 BLOCKBUSTERS — massive, architecture-aware (alley + plaza) */
  add(S, 'blk_hood', 1000, 280, (c, w, h) => drawBlock(c, w, h, { text: 'HOODDINO', face: '#2fb9b0', face2: '#1f8f8d', outline: '#10141c', shade: '#1c2f6e', seed: 11, depth: 12 }), { fade: 0.06, erase: 0.12, seed: 1 })
  add(S, 'blk_alterco', 920, 270, (c, w, h) => drawBlock(c, w, h, { text: 'ALTERCO', face: '#ff5d8f', face2: '#d6376d', outline: '#190f1c', shade: '#4a2670', seed: 12, depth: 11, rot: -0.025 }), { fade: 0.2, erase: 0.32, seed: 2 })
  add(S, 'blk_hood2', 1000, 280, (c, w, h) => drawBlock(c, w, h, { text: 'HOODDINO', face: '#f2c230', face2: '#d99a1a', outline: '#14110c', shade: '#b3261e', seed: 13, depth: 13, rot: 0.02 }), { fade: 0.12, erase: 0.2, paintOver: 0.34, cover: COVER[0], seed: 3 })
  add(S, 'blk_alterco2', 920, 270, (c, w, h) => drawBlock(c, w, h, { text: 'ALTERCO', face: '#e9e4d6', face2: '#bdb7a6', outline: '#111', shade: '#2a2a33', seed: 14, depth: 10 }), { fade: 0.04, erase: 0.06, seed: 4 })
  add(S, 'blk_dino', 520, 280, (c, w, h) => drawBlock(c, w, h, { text: 'DINO', face: '#7be05a', face2: '#4cae38', outline: '#0f1a12', shade: '#143a2a', seed: 15, depth: 12 }), { fade: 0.3, erase: 0.5, seed: 5 })

  /* 03 WILDSTYLE — rare */
  add(S, 'wild_kold', 560, 352, (c, w, h) => drawWild(c, w, h, { text: 'KOLD', a: '#ff9f3a', b: '#e0402a', outline: '#0f0f14', line: '#f2eee6', seed: 21 }), { fade: 0.1, erase: 0.16, cross: '#0e0e12', seed: 6 })
  add(S, 'wild_vert', 560, 352, (c, w, h) => drawWild(c, w, h, { text: 'VERT', a: '#7ae0d0', b: '#2a8fb0', outline: '#0c1018', line: '#f4f0e0', seed: 22 }), { fade: 0.04, seed: 7 })
  add(S, 'wild_skrt', 520, 340, (c, w, h) => drawWild(c, w, h, { text: 'SKRT', a: '#f4efe6', b: '#a8a3b5', outline: '#14131c', line: '#e0b840', seed: 23 }), { fade: 0.34, erase: 0.4, seed: 8 })

  /* 02 THROW-UPS — sparingly */
  add(S, 'thr_nyx', 460, 288, (c, w, h) => drawThrow(c, w, h, { text: 'NYX', fill: '#ffffff', fill2: '#cfd8ff', outline: '#14141c', rim: '#4a6bff', seed: 31 }), { fade: 0.08, erase: 0.1, seed: 9 })
  add(S, 'thr_raw', 460, 288, (c, w, h) => drawThrow(c, w, h, { text: 'RAW', fill: '#4ac8ff', outline: '#10131c', rim: '#f4efe6', seed: 32, rot: -0.06 }), { fade: 0.26, erase: 0.3, paintOver: 0.4, cover: COVER[1], seed: 10 })
  add(S, 'thr_jade', 460, 288, (c, w, h) => drawThrow(c, w, h, { text: 'JADE', fill: '#4be0a0', fill2: '#1fa06a', outline: '#0e1a14', rim: '#f2eee6', seed: 33 }), { fade: 0.02, seed: 11 })
  add(S, 'thr_moss', 460, 288, (c, w, h) => drawThrow(c, w, h, { text: 'MOSS', fill: '#ff7a3a', fill2: '#d6401a', outline: '#1a0f0a', seed: 34, rot: 0.05 }), { fade: 0.4, erase: 0.55, seed: 12 })

  /* 01 HAND TAGS — each a different writer */
  const H = (id: string, o: Parameters<typeof drawHand>[3], age: Age, w = 340, h = 170) => add(S, id, w, h, (c, ww, hh) => drawHand(c, ww, hh, o), age)
  H('hand_kold', { text: 'KOLD', face: 'marker', color: '#111114', seed: 41, crown: true, drips: 2 }, { fade: 0.1, erase: 0.15, seed: 20 })
  H('hand_nyx', { text: 'nyx', face: 'beanie', color: '#f4efe6', seed: 42, slant: 0.5, tracking: 0.04, jitter: 0.1 }, { fade: 0.05, seed: 21 })
  H('hand_skrt', { text: 'SKRT', face: 'salt', color: '#e0402a', seed: 43, rot: -0.1, underline: true }, { fade: 0.22, erase: 0.3, seed: 22 })
  H('hand_echo', { text: 'ECHO', face: 'marker', color: '#f4efe6', outline: '#111114', seed: 44, drips: 3 }, { fade: 0.02, seed: 23 })
  H('hand_hd', { text: 'HD', face: 'marker', color: '#2fb9b0', seed: 45, rot: 0.08, underline: true }, { fade: 0.15, erase: 0.2, cross: '#f2eee6', seed: 24 }, 260, 170)
  H('hand_jade', { text: 'jade', face: 'beanie', color: '#111114', seed: 46, slant: 0.3, tracking: 0.02 }, { fade: 0.3, erase: 0.4, seed: 25 })
  H('hand_raw', { text: 'RAW', face: 'salt', color: '#2a6bff', seed: 47, rot: 0.12, drips: 2 }, { fade: 0.08, seed: 26 })
  H('hand_vert', { text: 'vert', face: 'marker', color: '#ff5d8f', seed: 48, slant: 0.35, rot: -0.05 }, { fade: 0.18, erase: 0.2, paintOver: 0.33, cover: COVER[2], seed: 27 })
  H('hand_alt', { text: 'ALT', face: 'beanie', color: '#e8c548', seed: 49, slant: 0.45, jitter: 0.08, crown: true }, { fade: 0.04, seed: 28 }, 280, 170)
  H('hand_moss', { text: 'moss', face: 'salt', color: '#f4efe6', seed: 50, rot: -0.14 }, { fade: 0.38, erase: 0.5, seed: 29 })
  H('hand_oka', { text: 'OKA', face: 'marker', color: '#d6d0c0', outline: '#1a1a20', seed: 51, drips: 4, rot: 0.04 }, { fade: 0.12, erase: 0.18, seed: 30 }, 300, 170)
  H('hand_zed', { text: 'Z.E.D', face: 'beanie', color: '#9fb4ff', seed: 52, slant: 0.55, tracking: 0.08 }, { fade: 0.06, erase: 0.1, seed: 31 })
  H('hand_ink', { text: 'ink', face: 'salt', color: '#111114', seed: 53, rot: 0.06, underline: true }, { fade: 0.2, seed: 32 }, 260, 170)

  /* 05 STENCILS — repeatable, hard-edged, leaky, incomplete */
  add(S, 'st_hood_row', 460, 120, (c, w, h) => drawStencil(c, w, h, { text: 'HOODDINO', color: '#d8d2c0', seed: 61, holes: 36 }), { fade: 0.12, erase: 0.2, seed: 40 })
  add(S, 'st_alterco_row', 500, 120, (c, w, h) => drawStencil(c, w, h, { text: 'ALTERCO', color: '#b8322a', seed: 62, holes: 50 }), { fade: 0.3, erase: 0.35, seed: 41 })
  add(S, 'st_coords', 300, 90, (c, w, h) => drawStencil(c, w, h, { text: '45.0N 9.0E', color: '#d8d2c0', seed: 63, holes: 20 }), { fade: 0.18, seed: 42 })
  add(S, 'st_cross', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'crosshair', '#d8d2c0', 64), { fade: 0.1, erase: 0.14, seed: 43 })
  add(S, 'st_arrow', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'arrow', '#e8c548', 65), { fade: 0.28, erase: 0.32, seed: 44 })
  add(S, 'st_barcode', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'barcode', '#d8d2c0', 66), { fade: 0.2, erase: 0.24, seed: 45 })
  add(S, 'st_eye', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'eye', '#b8322a', 67), { fade: 0.15, seed: 46 })
  add(S, 'st_hd', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'hd', '#d8d2c0', 68), { fade: 0.08, erase: 0.1, seed: 47 })
  add(S, 'st_hour', 232, 232, (c, w, h) => drawSymbol(c, w, h, 'hourglass', '#9fb4ff', 69), { fade: 0.1, seed: 48 })
  // the number trail (each on a different object — see NumberTrail)
  add(S, 'n01', 232, 232, (c, w, h) => drawStencil(c, w, h, { text: '01', color: '#d8d2c0', seed: 71, sub: 'ALTERCO', holes: 26 }), { fade: 0.1, erase: 0.14, seed: 50 })
  add(S, 'n03', 232, 150, (c, w, h) => drawStencil(c, w, h, { text: '03', color: '#f4efe6', seed: 73, font: 'bungee', holes: 16 }), { fade: 0.14, erase: 0.2, seed: 51 })
  add(S, 'n05', 232, 170, (c, w, h) => drawHand(c, w, h, { text: '05', face: 'marker', color: '#ff7a3a', outline: '#111114', seed: 75, slant: 0.3, drips: 2 }), { fade: 0.06, erase: 0.1, seed: 52 })
  add(S, 'n06', 232, 232, (c, w, h) => drawStencil(c, w, h, { text: '06', color: '#e8e2d0', seed: 76, sub: 'TETTO', holes: 30 }), { fade: 0.16, erase: 0.2, seed: 53 })
  add(S, 'n07', 232, 232, (c, w, h) => drawStencil(c, w, h, { text: '07', color: '#e8e2d0', seed: 77, sub: 'ACQUA', holes: 22 }), { fade: 0.08, seed: 54 })

  /* 07 NOTES — small, intimate, for people who look */
  const N = (id: string, text: string, face: 'pen' | 'beanie', color: string, seed: number, extra: { circle?: boolean; arrow?: boolean; strike?: boolean } = {}, age: Partial<Age> = {}) =>
    add(S, id, 384, 120, (c, w, h) => drawNote(c, w, h, { text, face, color, seed, ...extra }), { seed: seed + 100, ...age })
  N('note_water', "l'acqua ricorda", 'pen', '#d8d2c0', 81, { circle: true }, { fade: 0.15 })
  N('note_far', 'guarda da lontano', 'beanie', '#9fb4ff', 82, { arrow: true }, { fade: 0.1 })
  N('note_sette', 'sette volte', 'pen', '#e8c548', 83, {}, { fade: 0.3, erase: 0.3 })
  N('note_roof', 'ci vediamo sul tetto', 'beanie', '#f4efe6', 84, { arrow: true }, { fade: 0.08 })
  N('note_other', 'c’è un altro lato', 'pen', '#d8d2c0', 85, {}, { fade: 0.2, erase: 0.2 })
  N('note_back', 'non tornare indietro', 'beanie', '#d8d2c0', 86, { strike: true }, { fade: 0.18 })
  N('note_hd', 'H.D. was here', 'pen', '#ff7a3a', 87, {}, { fade: 0.25, erase: 0.3 })
  N('note_ear', 'ascolta', 'beanie', '#f4efe6', 88, { circle: true }, { fade: 0.05 })
  add(S, 'uv_tag', 512, 256, (c, w, h) => drawUV(c, w, h, 91))
  add(S, 'glyph', 128, 128, (c, w, h) => drawGlyph(c, w, h))

  /* roof (reuses the same families) */
  add(S, 'roof_throw', 640, 256, (c, w, h) => drawThrow(c, w, h, { text: 'STARE BENE', fill: '#ff7a3a', fill2: '#ffd0a0', outline: '#14141c', rim: '#f2eee6', seed: 101 }), { fade: 0.12, erase: 0.14, seed: 60 })
  add(S, 'roof_block', 900, 220, (c, w, h) => drawBlock(c, w, h, { text: 'ALTERCO', face: '#4ac8ff', face2: '#2a8fd0', outline: '#0e1220', shade: '#6a1a5a', seed: 102, depth: 10 }), { fade: 0.18, erase: 0.25, seed: 61 })
  add(S, 'roof_wild', 560, 352, (c, w, h) => drawWild(c, w, h, { text: 'MOSS', a: '#f4efe6', b: '#a8c0e0', outline: '#101018', line: '#4be0a0', seed: 103 }), { fade: 0.22, erase: 0.3, seed: 62 })
  add(S, 'roof_hand', 340, 170, (c, w, h) => drawHand(c, w, h, { text: 'DINO', face: 'marker', color: '#4be0a0', seed: 104, drips: 3, underline: true }), { fade: 0.1, seed: 63 })

  /* 06 WHEATPASTE — editorial, printed */
  const titles = alterco.tracks.map((t) => t.title.replace(/è/gi, 'È').toUpperCase())
  const lines = (t: string) => {
    const w = t.split(' ')
    if (w.length <= 1) return [t]
    if (w.length === 2) return w
    return [w.slice(0, Math.ceil(w.length / 2)).join(' '), w.slice(Math.ceil(w.length / 2)).join(' ')]
  }
  const list = alterco.tracks.map((t, i) => `${String(i + 1).padStart(2, '0')} ${t.title.toUpperCase()}`)
  alterco.tracks.forEach((t, i) => {
    add(P, `tp_${i + 1}`, 384, 576, (c, w, h) => drawTrackPoster(c, w, h, { variant: (i % 4) as 0 | 1 | 2 | 3, n: t.n, title: lines(titles[i]), seed: 200 + i * 7, list, covered: i === 2 || i === 5 ? 0.35 : i === 0 ? 0.2 : 0 }))
  })
  add(P, 'tp_hood', 384, 576, (c, w, h) => drawBigPoster(c, w, h, { lines: ['HOOD', 'DINO'], sub: 'ALTERCO — 7 TRACCE', seed: 230, pal: 0, halftone: true }))
  // fragments / covers
  const frag = (id: string, bg: string, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, seed: number, w = 288, h = 220) =>
    add(P, id, w, h, (c, ww, hh) => paper(c, ww, hh, { bg, seed, fade: 0.1, yellow: 0.12, torn: 1.4 }, () => draw(c, ww, hh)))
  frag('fr_serif', '#d9d1bf', (c, w, h) => { c.fillStyle = '#14120f'; c.font = `italic 900 ${h * 0.5}px ${FONT.serif}`; c.fillText('Asc', w * 0.06, h * 0.62); c.fillStyle = '#b8322a'; c.fillRect(w * 0.06, h * 0.72, w * 0.5, 4) }, 240)
  frag('fr_anton', '#16161a', (c, w, h) => { c.fillStyle = '#e0b840'; c.font = `${h * 0.62}px ${FONT.anton}`; c.fillText('RUM', w * 0.05, h * 0.74) }, 241)
  frag('fr_mono', '#e6e0cf', (c, w, h) => { c.fillStyle = '#14161c'; c.font = `bold ${h * 0.07}px ${FONT.mono}`; list.forEach((l, i) => c.fillText(l, w * 0.06, h * (0.18 + i * 0.115))) }, 242)
  frag('fr_xerox', '#efece4', (c, w, h) => { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(w * 0.1, h * (0.2 + i * 0.15)); c.lineTo(w * (0.5 + 0.4 * rng(i + 9)()), h * (0.2 + i * 0.15)); c.stroke() } }, 243)
  add(P, 'fr_04', 300, 300, (c, w, h) => paper(c, w, h, { bg: '#e6dfcc', seed: 250, fade: 0.14, yellow: 0.14, torn: 2.2, cornerTear: true }, () => {
    c.fillStyle = '#b8322a'; c.font = `${h * 0.78}px ${FONT.bungee}`; c.textAlign = 'center'; c.fillText('04', w * 0.5, h * 0.78)
    c.fillStyle = '#14120f'; c.font = `bold ${h * 0.05}px ${FONT.mono}`; c.fillText('GIUDIZIO', w * 0.5, h * 0.92)
    scrap(c, -w * 0.15, -h * 0.05, w * 0.55, h * 0.4, '#16161a', 251, 2)
  }))
  // flyers (photocopies with tear-off tabs; cryptic but sourceless — no URLs)
  const flyer = (id: string, head: string[], sym: 'hourglass' | 'eye' | 'crosshair', seed: number) =>
    add(P, id, 320, 448, (c, w, h) => paper(c, w, h, { bg: '#ece8dd', seed, fade: 0.12, yellow: 0.12, torn: 1 }, () => {
      c.fillStyle = '#111'; let y = h * 0.16; const px = w * 0.17
      head.forEach((l) => { c.font = `${px}px ${FONT.anton}`; c.fillText(l, w * 0.07, y); y += px * 1.04 })
      c.save(); c.translate(w * 0.5, h * 0.55); drawSymbol(c, 150, 150, sym, '#111', seed); c.restore()
      c.fillStyle = '#111'; c.font = `bold ${h * 0.035}px ${FONT.mono}`; c.fillText('HOODDINO', w * 0.07, h * 0.78)
      // tear-off tabs, some already taken
      const rr = rng(seed)
      for (let i = 0; i < 8; i++) { if (rr() < 0.55) continue; const x = (w * (i + 0.5)) / 8; c.save(); c.translate(x, h * 0.99); c.rotate(-Math.PI / 2); c.font = `bold ${h * 0.03}px ${FONT.mono}`; c.fillText('HD  ·  ' + String(i + 1).padStart(2, '0'), h * 0.14, 0); c.restore() }
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, h * 0.82, w, 2)
    }))
  flyer('fl_1', ['HAI', 'VISTO', 'QUESTO', 'SUONO?'], 'eye', 260)
  flyer('fl_2', ['SETTE', 'VOLTE'], 'hourglass', 261)
  flyer('fl_3', ['CERCO', 'IL', 'LATO', 'GIUSTO'], 'crosshair', 262)
  // stickers
  add(P, 'stk_02', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'num', text: '02', seed: 270, bg: '#f2c230', fg: '#14110c' }))
  add(P, 'stk_hd', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'hd', seed: 271, bg: '#14161c', fg: '#f4efe6' }))
  add(P, 'stk_alt', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'alt', seed: 272, bg: '#f4efe6', fg: '#14161c' }))
  add(P, 'stk_eye', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'eye', seed: 273, bg: '#2a5ac8', fg: '#f4efe6' }))
  add(P, 'stk_seven', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'seven', seed: 274, bg: '#b8322a', fg: '#f4efe6' }))
  add(P, 'stk_hd2', 128, 128, (c, w, h) => drawSticker(c, w, h, { kind: 'hd', seed: 275, bg: '#e0b840', fg: '#14110c' }))
  void grain

  spray.pack(S)
  paperA.pack(P)
  return { spray, paper: paperA, sprayTex: spray.texture(), paperTex: paperA.texture(), spr: spray.cells, pap: paperA.cells }
}
