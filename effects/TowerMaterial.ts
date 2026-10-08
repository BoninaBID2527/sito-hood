import * as THREE from 'three'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'

/**
 * Procedural high-rise facades. No window texture: every building gets its own floor height, bay width,
 * material (brick / concrete / curtain wall) and a hash-driven window state per cell (dark & reflective,
 * warm, dim, cool, TV-flicker, blinds, fully-lit office floors, dead columns). Nothing repeats as a grid.
 * Per-building parameters arrive as the vertex attribute `aSeed` = (seed, floorH, bayW, style).
 */
const vert = /* glsl */ `
attribute vec4 aSeed;
varying vec3 vW;
varying vec3 vN;
varying vec4 vS;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vS = aSeed;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`
const frag = /* glsl */ `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec4 vS;
uniform float uTime;
uniform float uWin;
uniform vec3 uAmb;
uniform vec3 uSunCol;
uniform vec3 uSunDir;
uniform vec3 uSkyLow;
uniform vec3 uSkyHigh;
uniform float uContam;
#include <common>
#include <fog_pars_fragment>
float h3(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float h2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main() {
  vec3 N = normalize(vN);
  float seed = vS.x, floorH = vS.y, bayW = vS.z, style = vS.w;
  bool side = abs(N.y) < 0.5;
  float u = abs(N.x) > 0.5 ? vW.z : vW.x;
  float y = vW.y + 20.0;
  vec3 col;
  vec3 emis = vec3(0.0);

  // facade body
  vec3 brick = vec3(0.30, 0.20, 0.17), conc = vec3(0.30, 0.31, 0.33), glassC = vec3(0.11, 0.15, 0.2);
  vec3 body = style < 0.34 ? brick : style < 0.67 ? conc : glassC;
  body *= 0.8 + 0.4 * h3(vec3(floor(seed * 97.0), 1.0, 2.0));
  float nz = vn(vec2(u * 0.35, y * 0.25) + seed * 40.0);
  body *= 0.78 + 0.5 * nz;
  body *= 1.0 - 0.35 * smoothstep(0.55, 0.9, vn(vec2(u * 1.7, y * 0.04) + seed * 11.0));

  if (side) {
    float fl = floor(y / floorH), bay = floor(u / bayW);
    vec2 f = vec2(fract(u / bayW), fract(y / floorH));
    bool glassWall = style > 0.67;
    // V3.7: every building has its own window architecture — punched openings of different proportions, or continuous ribbon windows between
    // piers every third bay — so a skyline is not one grid repeated at different heights
    float ws = h3(vec3(floor(seed * 97.0), 3.0, 4.0));
    bool ribbon = !glassWall && ws > 0.6;
    vec2 lo = glassWall ? vec2(0.04, 0.1) : (ribbon ? vec2(0.0, 0.3) : vec2(0.14 + 0.1 * ws, 0.2 + 0.08 * ws));
    vec2 hi = glassWall ? vec2(0.96, 0.92) : (ribbon ? vec2(1.0, 0.72) : vec2(0.86 - 0.1 * ws, 0.82 - 0.06 * ws));
    float pierR = ribbon ? step(mod(bay, 3.0), 0.5) : 0.0;
    float win = step(lo.x, f.x) * step(f.x, hi.x) * step(lo.y, f.y) * step(f.y, hi.y) * (1.0 - pierR);
    vec2 wf = (f - lo) / (hi - lo);
    // frame: a centre mullion and a transom (curtain walls: a fine centre mullion only)
    float mull = 0.0;
    if (win > 0.5) {
      float vm = step(abs(wf.x - 0.5), glassWall ? 0.02 : 0.028);
      float hm = glassWall ? 0.0 : step(abs(wf.y - 0.7), 0.026);
      mull = max(vm, hm);
    }
    float hh = h3(vec3(bay, fl, seed * 31.0));
    float hb = h3(vec3(bay + 7.0, fl + 3.0, seed * 17.0));
    float floorLit = step(0.935, h3(vec3(fl, seed * 53.0, 5.0)));
    float deadCol = step(0.9, h3(vec3(bay, seed * 29.0, 9.0)));
    float roofCut = step(y, floorH * 40.0 + 40.0);
    // dark reflective glass
    vec3 sky = mix(uSkyLow, uSkyHigh, clamp(f.y * 0.9 + 0.1 * nz, 0.0, 1.0));
    vec3 glassCol = mix(vec3(dot(sky, vec3(0.33))), sky, 0.35) * (glassWall ? 0.22 : 0.1) + vec3(0.008, 0.01, 0.016);
    if (glassWall) glassCol *= 0.8 + 0.4 * smoothstep(0.3, 0.7, nz);
    // lit state
    vec3 warm = mix(vec3(1.0, 0.58, 0.26), vec3(1.0, 0.8, 0.52), hb);
    vec3 cool = vec3(0.6, 0.78, 1.0);
    vec3 lit = vec3(0.0);
    float lv = 0.0;
    if (floorLit > 0.5 && glassWall) { lit = mix(vec3(0.85, 0.92, 1.0), cool, hb); lv = 0.9; }
    else if (deadCol < 0.5) {
      if (hh > 0.985)      { lit = cool * (0.7 + 0.5 * sin(uTime * (1.3 + hb * 2.0) + hb * 30.0)); lv = 0.8; }       // TV flicker
      else if (hh > 0.96) { lit = cool; lv = 0.5; }
      else if (hh > 0.86) { lit = warm; lv = 0.32 + 0.4 * hb * hb; }
      else if (hh > 0.78) { lit = warm * vec3(1.0, 0.8, 0.6); lv = 0.12 + 0.2 * hb; }
    }
    // blinds: partial occlusion of lit windows
    float blinds = step(0.55, hb) * step(0.62, hh);
    lit *= mix(1.0, 0.45 + 0.55 * step(0.35, fract(f.y * 7.0 + hb * 3.0)), blinds);
    glassCol *= 0.82 + 0.36 * vn(vec2(u * 11.0, y * 0.5) + seed * 3.0); // streaky, dirty glass
    lit *= 0.72 + 0.55 * smoothstep(0.0, 1.0, wf.y);                      // the room's ceiling light: brighter high in the opening
    vec3 wcol = glassCol + lit * lv * uWin * 2.4 * (0.6 + 0.8 * hb);
    wcol = mix(wcol, body * (glassWall ? 0.6 : 0.5), mull * 0.85);
    // sills, mullions, slab line
    float slab = smoothstep(0.1, 0.0, f.y) * 0.5;
    // recessed look: the glass is darker toward its frame, brighter toward the middle
    float inset = smoothstep(0.0, 0.18, min(min(f.x - lo.x, hi.x - f.x), min(f.y - lo.y, hi.y - f.y)));
    wcol *= 0.55 + 0.45 * inset;
    // reveal shadow under the lintel and a lit sill edge: the opening has depth
    wcol *= 0.62 + 0.38 * smoothstep(hi.y - 0.2, hi.y - 0.06, hi.y - f.y + 0.0);
    wcol += vec3(0.05, 0.045, 0.04) * smoothstep(lo.y + 0.1, lo.y, f.y) * win * (glassWall ? 0.0 : 1.0);
    // facade structure: pilasters at the bay lines, a spandrel band under every opening, vertical weathering below sills
    if (!glassWall) {
      float pil = smoothstep(0.0, 0.07, min(f.x, 1.0 - f.x));
      float spand = smoothstep(lo.y - 0.12, lo.y - 0.02, f.y) * (1.0 - smoothstep(lo.y - 0.02, lo.y, f.y)) * 0.0 + smoothstep(0.0, lo.y, f.y) * 0.18;
      body *= mix(0.74, 1.04, pil) * (1.0 - spand + 0.18 * smoothstep(lo.y, hi.y, f.y));
      body *= 1.0 - 0.3 * smoothstep(0.25, 0.9, vn(vec2(u * 3.1, y * 0.07) + seed * 7.0)) * (1.0 - smoothstep(0.0, 0.5, f.y));
    } else {
      body *= 0.8 + 0.2 * smoothstep(0.0, 0.1, min(f.y, 1.0 - f.y)); // slab edge line
    }
    col = mix(body, wcol, win * roofCut);
    col *= 1.0 - slab;
    if (glassWall) col *= 1.0 - 0.45 * smoothstep(0.06, 0.0, abs(f.x - 0.5) - 0.0) * (1.0 - win * 0.0);
    emis = lit * lv * uWin * 2.4 * (0.6 + 0.8 * hb) * win * roofCut;
    // halo bleeding onto the wall around lit windows
    col += lit * lv * uWin * 0.12 * (1.0 - win) * step(0.62, hh);
    // direct light on the body
    float nd = max(dot(N, uSunDir), 0.0);
    col = col * (uAmb * 1.2 + uSunCol * nd * 0.5 * (1.0 - win * 0.9));
  } else {
    col = vec3(0.045, 0.05, 0.06) * (uAmb * 3.0 + 0.2) * (0.8 + 0.4 * nz);
  }
  col += emis * 0.0;
  col += uContam * 0.03 * (0.5 + 0.5 * cos(6.283 * (vec3(0.0, 0.33, 0.67) + vW.y * 0.01 + vW.x * 0.004)));
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`

const _grey = new THREE.Color('#8a8a92')

export function createTowerMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 }, uWin: { value: 0.5 }, uAmb: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0.2, 0.3, -1).normalize() }, uSkyLow: { value: new THREE.Color() }, uSkyHigh: { value: new THREE.Color() },
        uContam: { value: 0 },
      },
    ]),
  })
}

export function updateTowerMaterial(m: THREE.ShaderMaterial) {
  const u = m.uniforms
  u.uTime.value = rt.time
  u.uWin.value = 0.12 + palette.windows * 0.95
  u.uAmb.value.copy(palette.hemiSky).lerp(_grey, 0.5).multiplyScalar(0.55 * palette.hemiI + 0.1)
  u.uSunCol.value.copy(palette.sun).multiplyScalar(palette.sunI * 0.9)
  u.uSkyLow.value.copy(palette.horizon).lerp(palette.skyMid, 0.35).lerp(_grey, 0.35)
  u.uSkyHigh.value.copy(palette.skyTop).lerp(palette.skyMid, 0.5).lerp(_grey, 0.35)
  u.uContam.value = rt.fx.contam
}

/** Adds the per-building attribute (seed, floor height, bay width, style) to every vertex of a (box) geometry. */
export function tagBuilding(g: THREE.BufferGeometry, seed: number, floorH: number, bayW: number, style: number) {
  const n = g.attributes.position.count
  const a = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) a.set([seed, floorH, bayW, style], i * 4)
  g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4))
  return g
}
