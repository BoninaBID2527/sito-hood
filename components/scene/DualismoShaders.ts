/**
 * DUALISMO — shader library (V3.6 rebuild).
 *
 * One analytic atmosphere (`dualSky`) is shared by the sky dome, the glass reflections, the floor and the aerial-perspective fog,
 * so every surface dissolves into EXACTLY the colour of the backdrop behind it (no fog wall, no horizon line).
 * All values are linear HDR (the post pass owns tone mapping + sRGB).
 *
 * Material model for the glass: Schlick Fresnel · iron-glass absorption (thick paths go teal) · a thin-film term that only shows
 * at grazing angles and on bevels · reflections of a tiny analytic studio (two soft strips) · light that comes FROM the artwork.
 * No textures, no scene capture, no transparency: the monoliths are opaque and write depth.
 */

export const DUAL_COMMON = /* glsl */ `
const vec3 C_HOR  = vec3(0.0150, 0.0165, 0.0640);  // horizon haze: cobalt-violet, the colour everything dissolves into
const vec3 C_ZEN  = vec3(0.0012, 0.0014, 0.0060);  // zenith: near black
const vec3 C_COOL = vec3(0.050, 0.150, 0.420);     // left pole: teal-cobalt
const vec3 C_WARM = vec3(0.560, 0.120, 0.200);     // right pole: rose (the warm dots of the artwork)
const vec3 C_PALE = vec3(0.260, 0.270, 0.520);     // lavender source straight ahead, behind the gate

vec3 dualSky(vec3 d) {
  float h = d.y;
  vec3 col = mix(C_HOR, C_ZEN, smoothstep(0.0, 0.5, h));
  col = mix(col, C_HOR * 0.35, smoothstep(0.0, -0.3, h));
  vec2 hd = normalize(d.xz + vec2(1e-5));
  float band = exp(-h * h * 70.0);
  float lc = pow(max(dot(hd, vec2(-0.80, -0.60)), 0.0), 10.0);
  float lw = pow(max(dot(hd, vec2( 0.80, -0.60)), 0.0), 10.0);
  float lp = pow(max(-hd.y, 0.0), 40.0);
  col += (C_COOL * lc + C_WARM * lw + C_PALE * lp) * band * 0.55;
  return col;
}

// a soft vertical strip light in direction space (az = 0 is behind the camera, +z)
float bar(vec3 R, float az, float w, float y0, float y1) {
  vec2 hd = normalize(R.xz + vec2(1e-5));
  vec2 c = vec2(sin(az), cos(az));
  float lat = hd.x * c.y - hd.y * c.x;
  float fw = step(0.0, dot(hd, c));
  return fw * smoothstep(w, w * 0.35, abs(lat)) * smoothstep(y0 - 0.08, y0 + 0.02, R.y) * smoothstep(y1 + 0.08, y1 - 0.02, R.y);
}

// the tiny studio the glass reflects: the atmosphere plus two soft strips (key, violet rim) and a cool kicker
vec3 dualEnv(vec3 R) {
  vec3 e = dualSky(R);
  e += vec3(0.95, 0.97, 1.15) * bar(R, -0.50, 0.10, 0.05, 0.85) * 0.8;
  e += vec3(0.80, 0.55, 1.00) * bar(R,  0.78, 0.04, -0.10, 0.60) * 0.8;
  e += vec3(0.45, 0.90, 0.90) * bar(R,  2.40, 0.18, 0.00, 0.60) * 0.4;
  return e;
}

// thin-film interference: optical path difference 2·n·d·cosθt against three wavelengths (µm). Desaturated: it is a sheen, not a rainbow.
vec3 thinFilm(float cosT, float d) {
  float n = 1.33;
  float ct = sqrt(max(0.0, 1.0 - (1.0 - cosT * cosT) / (n * n)));
  vec3 ph = 6.28318 * (2.0 * n * d * ct) / vec3(0.62, 0.54, 0.45);
  vec3 f = 0.5 + 0.5 * cos(ph);
  return mix(vec3(dot(f, vec3(0.3, 0.55, 0.15))), f, 0.72);
}

float dualFog(float dist) { return 1.0 - exp(-pow(dist * 0.0062, 1.55)); }
float dhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`

/* ───────────────────────── backdrop dome ───────────────────────── */

export const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}
`
export const domeFrag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uFade, uTime;
${DUAL_COMMON}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = dualSky(d);
  // a handful of far stars, only in the dark upper sky
  if (d.y > 0.08) {
    vec3 sp = floor(d * 220.0);
    float s = step(0.9982, dhash(sp));
    float tw = 0.55 + 0.45 * sin(uTime * 1.3 + dhash(sp + 3.0) * 40.0);
    col += s * tw * 0.55 * smoothstep(0.08, 0.4, d.y) * vec3(0.8, 0.85, 1.0);
  }
  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/* ───────────────────────── glass monoliths (instanced, opaque) ───────────────────────── */

export const monoVert = /* glsl */ `
attribute vec3 aDim;
attribute vec4 aMisc;   // x seed, y cleave (fraction of the height the top face drops across its width), z bevel radius
varying vec3 vN;
varying vec3 vWP;
varying float vSeed;
varying float vLY;
varying vec3 vLoc;
varying vec3 vLN;
varying vec3 vVL;
varying vec3 vDim;
void main() {
  vec3 sg = sign(position);
  float bv = aMisc.z;
  vec3 p = sg * (0.5 * aDim - bv) + normal * bv;   // constant-radius bevel at any scale
  vec3 n = normal;
  float cut = aMisc.y;
  if (cut != 0.0) {                                // cleaved top: an impossible, mineral angle
    p.y -= step(0.0, sg.y) * cut * aDim.y * (sg.x * 0.5 + 0.5);
    if (normal.y > 0.7) n = normalize(vec3(cut * aDim.y / aDim.x, 1.0, 0.0));
  }
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vSeed = aMisc.x;
  vLY = p.y / aDim.y + 0.5;
  vLoc = p;
  vLN = n;
  vDim = aDim;
  mat3 M = mat3(modelMatrix) * mat3(instanceMatrix);
  vVL = transpose(M) * (cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
export const monoFrag = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vWP;
varying float vSeed;
varying float vLY;
varying vec3 vLoc;
varying vec3 vLN;
varying vec3 vVL;
varying vec3 vDim;
uniform float uTime, uFade, uArtI, uSheen;
uniform vec3 uArt, uArtCol;
${DUAL_COMMON}
// the far edges of a thick slab, seen THROUGH its face: they slide against the real edges as the viewpoint moves (the cue that says "solid glass")
float ghostEdges(vec2 p, vec2 off, vec2 h, vec2 aw) {
  vec2 q = abs(p - off);
  vec2 l = smoothstep(aw * 1.6, vec2(0.0), abs(q - h));
  vec2 inside = step(q.yx, h.yx + aw.yx);
  return max(l.x * inside.x, l.y * inside.y);
}
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vWP;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float inv = 1.0 - ndv;
  float F = 0.045 + 0.955 * pow(inv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 env = dualEnv(R);

  // iron-glass body: long paths (grazing) absorb red and go teal; a faint inner light climbs from the floor
  float path = 1.0 / max(ndv, 0.15);
  vec3 absorb = exp(-vec3(1.5, 0.45, 0.65) * 0.30 * path);
  vec3 q = vWP - V * 0.9;                           // a point inside the slab, along the view ray (cheap parallax, no refraction)
  float streak = smoothstep(0.93, 1.0, sin(q.x * 0.95 + q.y * 0.32 + vSeed * 31.0));
  float streak2 = smoothstep(0.96, 1.0, sin(q.x * 2.1 - q.y * 0.18 + vSeed * 17.0 + 1.3));
  float floorGlow = smoothstep(0.42, 0.0, vLY);
  // two poles: faces left of the axis lean cool, right of it lean rose (the two halves of DUALISMO)
  vec3 poleC = mix(vec3(0.20, 0.55, 1.00), vec3(1.00, 0.34, 0.60), smoothstep(-7.0, 7.0, vWP.x - uArt.x));
  vec3 inner = vec3(0.004, 0.016, 0.030) * (0.25 + 0.75 * inv) * absorb
             + poleC * floorGlow * 0.035
             + vec3(0.016, 0.050, 0.085) * streak * 0.5 * (0.3 + 0.7 * inv)
             + vec3(0.030, 0.016, 0.060) * streak2 * 0.3;

  // thin-film sheen: thickness wanders with height and seed, visible only toward grazing angles
  float d = 0.38 + 0.14 * sin(vWP.y * 0.21 + vSeed * 12.0 + uTime * 0.05) + 0.06 * sin(vWP.x * 0.9 + vSeed * 40.0);
  vec3 film = thinFilm(ndv, d);
  vec3 specCol = env * F * mix(vec3(1.0), film * 1.7, 0.7 * inv * inv);

  // light from the artwork: it is an emitter, the glass nearest to it catches it
  vec3 L = uArt - vWP;
  float dl = length(L);
  L /= dl;
  float att = 1.0 / (1.0 + dl * dl * 0.035);
  float lam = max(dot(N, L), 0.0);
  vec3 artGlow = uArtCol * uArtI * att * (lam * 0.8 + pow(max(dot(N, normalize(L + V)), 0.0), 60.0) * 2.2);
  // faint ambient from the atmosphere itself: faces turned toward the cool pole take the cool light, toward the warm pole the rose
  vec3 amb = dualSky(normalize(N + vec3(0.0, 0.12, 0.0))) * 0.14 * (0.5 + 0.5 * ndv);
  // the hero: the sleeve's light bleeds into the glass around it (milky near the picture, clear and dark toward the edges)
  float dE = length(max(abs(vLoc.xy) - vec2(1.72), 0.0));
  vec3 spill = uArtCol * exp(-dE * 2.0) * smoothstep(0.85, 0.99, vLN.z) * 0.13 * uSheen * uArtI;

  // bevels and grazing faces: where glass is thick it catches light along its edge (iron-glass green-cyan, with the film on top)
  vec3 edge = mix(poleC * vec3(0.9, 1.0, 0.9), film * 1.4, 0.45) * pow(inv, 2.6) * 0.42;
  // a long soft sheen travelling across the front face as the viewpoint moves (the hero only)
  float sh = R.x * 0.85 + R.y * 0.55 + 0.05 * sin(uTime * 0.12);
  vec3 sheen = vec3(0.70, 0.85, 1.20) * (smoothstep(0.09, 0.0, abs(sh - 0.04)) * 0.10 + smoothstep(0.35, 0.0, abs(sh - 0.04)) * 0.035) * uSheen;
  vec3 aw = fwidth(vLoc);
  vec3 Vl = normalize(vVL);
  vec3 an = abs(vLN);
  float ghost = 0.0;
  if (an.z > 0.85)      ghost = ghostEdges(vLoc.xy, Vl.xy / max(abs(Vl.z), 0.3) * vDim.z * 0.55, 0.5 * vDim.xy, aw.xy);
  else if (an.x > 0.85) ghost = ghostEdges(vLoc.zy, Vl.zy / max(abs(Vl.x), 0.3) * vDim.x * 0.55, 0.5 * vDim.zy, aw.zy);
  else if (an.y > 0.85) ghost = ghostEdges(vLoc.xz, Vl.xz / max(abs(Vl.y), 0.3) * vDim.y * 0.55, 0.5 * vDim.xz, aw.xz);
  vec3 ghostC = mix(poleC, vec3(0.8, 0.9, 1.0), 0.35) * ghost * (0.10 + 0.22 * inv) * (0.6 + 0.4 * streak);
  vec3 col = inner + amb + specCol + edge + sheen + spill + ghostC + artGlow * (0.25 + 0.75 * inv);
  // aerial perspective: near is sharp, far dissolves into the exact colour of the backdrop
  float k = dualFog(dist);
  col = mix(col, dualSky(-V), k);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/* ───────────────────────── mirror floor ───────────────────────── */

export const floorVert = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vUv;
varying vec3 vW;
void main() {
  #ifdef REAL
  vUv = textureMatrix * vec4(position, 1.0);
  #else
  vUv = vec4(0.0);
  #endif
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
export const floorFrag = /* glsl */ `
precision highp float;
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform float uTime, uFade, uArtI;
uniform vec3 uArt, uArtCol;
varying vec4 vUv;
varying vec3 vW;
${DUAL_COMMON}
void main() {
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float cosT = clamp(V.y, 0.0, 1.0);
  float inv = 1.0 - cosT;
  float F = 0.05 + 0.95 * pow(inv, 5.0);
  float dd = length(vW.xz - cameraPosition.xz);
  float rough = smoothstep(6.0, 110.0, dd);

  #ifdef REAL
  vec2 uv = vUv.xy / vUv.w;
  // slow liquid normals (tiny, fade with distance)
  vec2 w = vec2(sin(vW.z * 0.55 + uTime * 0.35) + sin(vW.x * 0.8 - uTime * 0.27), cos(vW.x * 0.5 + uTime * 0.31) + sin(vW.z * 0.9 - uTime * 0.22));
  uv += w * 0.00035 * (1.0 - rough * 0.6);
  // polished stone, not a flat mirror: the smear grows with distance and is vertical (anisotropic)
  float b = 0.0015 + 0.012 * rough;
  vec3 refl = texture2D(tDiffuse, uv).rgb * 0.34
            + (texture2D(tDiffuse, uv + vec2(0.0, b)).rgb + texture2D(tDiffuse, uv - vec2(0.0, b)).rgb) * 0.20
            + (texture2D(tDiffuse, uv + vec2(0.0, 2.0 * b)).rgb + texture2D(tDiffuse, uv - vec2(0.0, 2.0 * b)).rgb) * 0.13;
  #else
  vec3 refl = dualEnv(reflect(-V, vec3(0.0, 1.0, 0.0)));
  // the monolith's reflection as a soft vertical streak beneath it
  float sx = (vW.x - uArt.x);
  refl += uArtCol * uArtI * exp(-sx * sx / 5.0) * smoothstep(60.0, 0.0, -vW.z + 4.0) * 0.35 * smoothstep(14.0, -1.0, vW.z);
  #endif

  // reflectivity: dielectric Fresnel on near-black glass, boosted toward grazing, relaxed by roughness at distance
  float R = (0.17 + 0.9 * F) * (1.0 - 0.72 * rough);

  // the artwork spills light forward onto the floor (cool left, rose right: the two poles of the artwork)
  vec2 dp = vW.xz - uArt.xz - vec2(0.0, 2.6);
  float pool = exp(-(dp.x * dp.x / 30.0 + dp.y * dp.y / 55.0));
  vec3 poolC = mix(uArtCol * vec3(0.8, 0.9, 1.1), uArtCol * vec3(1.15, 0.8, 0.9), smoothstep(-4.0, 4.0, dp.x)) * pool * uArtI * 0.12 * (1.0 - rough);

  // slab seams: the floor is cut stone, which gives it scale and a reason to catch light
  vec2 g = vW.xz / 7.0;
  vec2 gl = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
  float seam = 1.0 - min(min(gl.x, gl.y), 1.0);
  vec3 seamC = vec3(0.10, 0.14, 0.30) * seam * (0.002 + 0.07 * F) * (1.0 - rough);

  vec3 film = thinFilm(cosT, 0.45 + 0.12 * sin(vW.x * 0.07 + vW.z * 0.05));
  vec3 col = vec3(0.0025, 0.0032, 0.0085) + poolC + seamC;
  col += refl * R * mix(vec3(1.0), film * 1.5, 0.5 * inv * inv);

  float k = dualFog(dist);
  col = mix(col, dualSky(-V), k);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/* ───────────────────────── the great gate (distant ring, mirrored by the floor into a full circle) ───────────────────────── */

export const ringVert = /* glsl */ `
varying vec3 vN;
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
export const ringFrag = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vWP;
uniform float uTime, uFade;
${DUAL_COMMON}
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vWP;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float inv = 1.0 - ndv;
  // two poles on one hoop: cool to the left, warm to the right, pale at the crown
  float sx = smoothstep(-34.0, 34.0, vWP.x - cameraPosition.x);
  vec3 pole = mix(vec3(0.45, 0.62, 1.0), vec3(1.0, 0.55, 0.75), sx);
  vec3 film = thinFilm(ndv, 0.40 + 0.2 * sin(atan(vWP.y + 2.6, vWP.x - cameraPosition.x) * 3.0 + uTime * 0.05));
  float edge = pow(inv, 2.2);
  vec3 col = pole * (0.075 + 0.6 * edge) + film * 0.10 * edge;
  float k = min(dualFog(dist), 0.30);
  col = mix(col, dualSky(-V), k);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/* ───────────────────────── satellite coin (track token) ───────────────────────── */

export const coinVert = /* glsl */ `
varying vec3 vN;
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
export const coinFrag = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vWP;
uniform float uTime, uFade, uGlow;
uniform vec3 uTint;
${DUAL_COMMON}
void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vWP;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float inv = 1.0 - ndv;
  float F = 0.05 + 0.95 * pow(inv, 4.0);
  vec3 env = dualEnv(reflect(-V, N));
  vec3 film = thinFilm(ndv, 0.34 + 0.2 * inv + 0.05 * sin(uTime * 0.3));
  vec3 col = uTint * (0.01 + 0.10 * pow(inv, 1.6) * (0.4 + uGlow));
  col += env * F * mix(vec3(1.0), film * 1.8, 0.8 * inv);
  col += film * uTint * pow(inv, 2.5) * 0.5 * (0.4 + uGlow);
  float k = dualFog(dist);
  col = mix(col, dualSky(-V), k);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/* ───────────────────────── hero bezel (thin-film border around the inlaid cover) ───────────────────────── */

export const bezelFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uFade, uGlow;
${DUAL_COMMON}
void main() {
  vec2 p = abs(vUv - 0.5) * 2.0;           // 0 centre … 1 outer edge of the bezel plane
  float e = max(p.x, p.y);
  // inner edge (against the cover) and outer edge carry a thin, bright, iridescent line; between them dark polished glass
  float inner = smoothstep(0.045, 0.0, abs(e - 0.905));
  float outer = smoothstep(0.03, 0.0, abs(e - 0.985));
  vec3 film = thinFilm(0.55 + 0.4 * sin(vUv.y * 3.0 + vUv.x * 2.0 + uTime * 0.12), 0.42 + 0.1 * sin(uTime * 0.2 + vUv.x * 4.0));
  vec3 col = vec3(0.004, 0.006, 0.014) + mix(vec3(0.75, 0.82, 1.0), film, 0.55) * (inner * 0.42 + outer * 0.22) * (0.5 + 0.5 * uGlow);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/* ───────────────────────── tiny helpers: motes, shafts, entry rings, glints ───────────────────────── */

export const moteVert = /* glsl */ `
attribute float aSeed;
uniform float uTime, uArrive, uPx;
uniform vec3 uMouse;
varying float vA;
varying vec3 vC;
void main() {
  vec3 p = position;
  float t = uTime * 0.07;
  p += vec3(sin(t + aSeed * 40.0), cos(t * 1.3 + aSeed * 23.0) * 0.6 + t * 0.0, sin(t * 0.7 + aSeed * 11.0)) * 0.8;
  p.y += mod(uTime * 0.03 * (0.4 + aSeed) + aSeed * 12.0, 8.0) - 4.0;   // slow rise, wrapped
  p *= 0.4 + 0.6 * uArrive;
  vec3 d = p - uMouse;
  float dist = length(d);
  p += normalize(d + 1e-4) * smoothstep(2.4, 0.0, dist) * 0.9;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float z = max(0.6, -mv.z);
  // depth of field: motes close to the camera are large, soft and dim; far ones tiny and crisp
  float near = smoothstep(14.0, 3.0, z);
  gl_PointSize = uPx * (2.0 + 44.0 / z * (0.35 + aSeed * 0.9)) * (1.0 + near * 1.5);
  vA = (0.22 + 0.78 * aSeed) * smoothstep(0.0, 4.0, z) * (1.0 - 0.7 * near) * (0.65 + 0.35 * sin(uTime * 0.8 + aSeed * 90.0));
  vC = mix(vec3(0.62, 0.74, 1.0), vec3(0.95, 0.88, 1.0), fract(aSeed * 7.0));
}
`
export const moteFrag = /* glsl */ `
precision highp float;
varying float vA;
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vC * a * a * vA * 0.5, a * a * vA);
}
`

export const shaftVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`
export const shaftFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vW;
uniform float uTime, uFade, uSeed;
uniform vec3 uColor;
void main() {
  float u = vUv.x - 0.5;
  float across = exp(-u * u * 26.0);
  // fine dust-lit striations, drifting extremely slowly
  float str = 0.62 + 0.38 * sin(u * 41.0 + uSeed * 9.0 + uTime * 0.05) * sin(u * 17.0 - uSeed * 5.0 - uTime * 0.03);
  float along = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y)) * 1.4;
  float near = smoothstep(5.0, 18.0, distance(cameraPosition, vW));
  float a = across * str * along * near * uFade * 0.12;
  gl_FragColor = vec4(uColor * a, a);
}
`

export const entryRingVert = /* glsl */ `
attribute float aSeed;
varying float vSeed;
varying vec3 vN;
varying vec3 vWP;
void main() {
  vSeed = aSeed;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
export const entryRingFrag = /* glsl */ `
precision highp float;
varying float vSeed;
varying vec3 vN;
varying vec3 vWP;
uniform float uFade, uTime;
${DUAL_COMMON}
void main() {
  vec3 V = normalize(cameraPosition - vWP);
  float ndv = abs(dot(normalize(vN), V));
  vec3 film = thinFilm(ndv, 0.34 + 0.22 * fract(vSeed * 3.7));
  float a = uFade * (0.25 + 0.75 * pow(1.0 - ndv, 1.4));
  gl_FragColor = vec4(film * a * 0.55, a);
}
`

export const doorFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uGlow;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float across = exp(-p.x * p.x * 7.0);
  float core = exp(-p.x * p.x * 90.0);
  float along = smoothstep(1.0, 0.55, abs(p.y));
  float flick = 0.94 + 0.06 * sin(uTime * 1.7 + p.y * 3.0);
  vec3 c = vec3(1.0, 0.56, 0.24) * across * 0.55 + vec3(1.0, 0.86, 0.62) * core * 1.1;
  float a = (across * 0.45 + core) * along * flick * (0.55 + 0.45 * uGlow);
  gl_FragColor = vec4(c * a, a);
}
`
