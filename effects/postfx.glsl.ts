export const postVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Single full-screen pass. Everything is gated by uniforms, so at rest the cost is:
 * 3 scene taps (chromatic split) + optional bloom ring. Heavy branches only run while a
 * transition (liquid / tunnel / glitch) is active.
 */
export const postFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tArt;
uniform sampler2D tArt2;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform float uRgb;
uniform float uLiquid;
uniform float uCross;
uniform float uTunnel;
uniform float uContam;
uniform float uFade;
uniform float uGlitch;
uniform float uNeg;
uniform float uGrain;
uniform float uVig;
uniform float uExposure;
uniform float uBloom;
uniform float uDual;
uniform float uDim;
uniform vec3 uRipple;
uniform vec2 uPointer;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// channel-split scene sample; 'off' is in uv units
vec3 scene(vec2 uv, vec2 off) {
  return vec3(
    texture2D(tScene, uv + off).r,
    texture2D(tScene, uv).g,
    texture2D(tScene, uv - off).b
  );
}

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  vec2 ca = vec2(c.x * uAspect, c.y);
  float r = length(ca);
  float L = uLiquid;
  float T = uTunnel;

  // rare, purposeful glitch: horizontal slice tearing
  if (uGlitch > 0.001) {
    float t = floor(uTime * 16.0);
    float band = floor(uv.y * 26.0);
    float h = hash(vec2(band, t));
    if (h > 0.78) uv.x += (hash(vec2(band, t + 3.0)) - 0.5) * 0.14 * uGlitch;
  }

  // pointer ripple (hovered puddle)
  if (uRipple.z > 0.001) {
    vec2 d = uv - uRipple.xy; d.x *= uAspect;
    float dist = length(d);
    float w = sin(dist * 70.0 - uTime * 9.0) * exp(-dist * 5.5) * uRipple.z * 0.012;
    uv += normalize(d + 1e-4) * w;
  }

  // contamination: reality starts to behave like water (very subtle, grows toward the reveal)
  if (uContam > 0.02) {
    float k = uContam;
    float n = fbm(vec2(uv.x * uAspect, uv.y) * 2.4 + vec2(uTime * 0.05, -uTime * 0.04));
    uv += (n - 0.5) * 0.012 * k * k;
    uv.y += sin(uv.x * 14.0 + uTime * 0.8) * 0.0009 * k;
  }

  // liquid pass-through: we look THROUGH a refractive surface (water normals, radial lens, shock ring at the break)
  float ringAmt = 0.0;
  if (L > 0.001) {
    vec2 q = vec2(uv.x * uAspect, uv.y);
    float t = uTime * 0.3;
    vec2 w = vec2(fbm(q * 2.6 + t), fbm(q * 2.6 + vec2(5.2, 1.3) - t));
    vec2 pc = vec2(0.5, 0.42);
    vec2 d = (uv - pc) * vec2(uAspect, 1.0);
    float rr = length(d);
    float rip = sin(rr * 38.0 - uTime * 5.5) * smoothstep(1.3, 0.0, rr);
    float lens = (1.0 - smoothstep(0.0, 1.1, rr)) * L * 0.2;
    uv += (w - 0.5) * 0.15 * L * L + normalize(d + 1e-4) * rip * 0.02 * L - (uv - pc) * lens;
    float ringR = (1.0 - uCross) * 1.5;
    ringAmt = exp(-pow((rr - ringR) * 7.0, 2.0)) * uCross;
    uv += normalize(d + 1e-4) * ringAmt * 0.06;
  }

  // chromatic aberration — radial, grows toward the edges
  float amt = uRgb * (0.35 + r * 1.6) + L * 0.012 + ringAmt * 0.032 + T * 0.03;
  vec2 dir = normalize(c + 1e-5) * amt;
  dir.x /= uAspect;

  vec3 col;
  if (T > 0.001) {
    // dualismo tunnel: radial zoom blur toward the vanishing point
    vec3 acc = vec3(0.0);
    const int N = 12;
    for (int i = 0; i < N; i++) {
      float f = float(i) / float(N);
      float s = 1.0 - T * 0.34 * f;
      vec2 u = 0.5 + c * s;
      acc += scene(u, dir * (1.0 + f * 4.0));
    }
    col = acc / float(N);
    float ring = smoothstep(0.0, 0.7, r) * T;
    col += ring * 0.35 * vec3(0.30 + 0.25 * sin(r * 9.0 - uTime * 2.0), 0.45 + 0.3 * sin(r * 9.0 - uTime * 2.0 + 2.1), 0.8 + 0.2 * sin(r * 9.0 - uTime * 2.0 + 4.2));
    col *= 1.0 + T * 0.5 * smoothstep(0.5, 0.0, r);
  } else {
    col = scene(uv, dir);
  }

  // water body: colour absorption, caustics, and the album bleeding into the water as a faint spectral ghost
  if (L > 0.25) {
    float k = smoothstep(0.25, 1.0, L);
    vec2 q = vec2(uv.x * uAspect, uv.y);
    float t = uTime * 0.25;
    float cau = pow(max(0.0, 1.0 - abs(fbm(q * 5.0 + t * 2.0) - fbm(q * 5.0 - t * 1.5 + 3.0)) * 6.0), 3.0);
    col = mix(col, col * vec3(0.68, 0.9, 1.12) + vec3(0.0, 0.015, 0.03), k * 0.6);
    col += vec3(0.25, 0.5, 0.7) * cau * 0.2 * k * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.9, r)));
    vec2 w2 = vec2(fbm(q * 2.0 + t) - 0.5, fbm(q * 2.0 + 7.3 - t) - 0.5);
    vec2 au = 0.5 + (uv - 0.5) * vec2(min(1.0, uAspect * 0.9), 1.0) * 0.9 + w2 * 0.14 * L;
    float split = 0.014 * L;
    vec3 art = vec3(texture2D(tArt, au + vec2(split, 0.0)).r, texture2D(tArt, au).g, texture2D(tArt, au - vec2(split, 0.0)).b);
    float m = smoothstep(0.7, 1.0, L) * (0.14 + 0.2 * smoothstep(0.0, 0.7, r));
    col = mix(col, col + art * 0.5, m);
    col += ringAmt * vec3(0.55, 0.8, 1.0) * 0.2;
  }

  // bloom — only genuinely emissive (HDR) pixels
  if (uBloom > 0.01) {
    vec3 b = vec3(0.0);
    // Vogel-disk taps with a per-pixel rotation: no rosette/flower pattern around hot lights, the residue reads as grain
    float rot = hash(uv * uRes) * 6.2831853;
    for (int i = 0; i < 10; i++) {
      float fi = float(i);
      float rr = sqrt((fi + 0.5) / 10.0);
      float a = fi * 2.399963 + rot;
      vec2 o = vec2(cos(a), sin(a)) * rr;
      b += max(texture2D(tScene, uv + o * vec2(0.010 / uAspect, 0.010)).rgb - 0.95, 0.0);
      b += max(texture2D(tScene, uv + o * vec2(0.026 / uAspect, 0.026)).rgb - 0.95, 0.0) * 0.9;
    }
    col += b * uBloom * 0.16;
  }

  col *= uExposure;
  col = aces(col);

  // soft grade: cool shadows / warm highlights, tiny lift
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * vec3(0.96, 1.0, 1.06), (1.0 - lum) * 0.35);
  col = mix(col, col * vec3(1.05, 1.0, 0.94), lum * 0.3);

  col = pow(col, vec3(1.0 / 2.2));

  // Dualismo grade: iridescent lift
  if (uDual > 0.001) {
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + r * 1.4 + uTime * 0.03 + lum));
    col = mix(col, col * 0.78 + irid * 0.17 * (0.3 + lum), uDual * 0.55);
  }

  // dim while a track is focused
  col *= 1.0 - uDim * 0.6;

  // vignette
  float vg = smoothstep(0.35, 0.95, r * (1.0 + uVig * 0.55));
  col *= 1.0 - vg * uVig * 0.8;

  // analogue grain (24fps stepping)
  float g = hash(uv * uRes + floor(uTime * 24.0) * 7.31) - 0.5;
  col += g * uGrain * 0.085 * (1.0 - lum * 0.5);

  col = mix(col, 1.0 - col, uNeg);
  col *= uFade;
  gl_FragColor = vec4(col, 1.0);
}
`
