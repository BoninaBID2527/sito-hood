import * as THREE from 'three'

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform float uTime;
uniform float uBulge;
void main() {
  vUv = uv;
  vec3 p = position;
  // sleeve breathes a little; bulge is used during the reveal
  p.z += sin(uv.x * 6.0 + uTime * 0.8) * sin(uv.y * 5.0 - uTime * 0.6) * 0.03 * uBulge;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`
const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform sampler2D map;
uniform float uTime;
uniform float uFlow;
uniform float uSplit;
uniform float uReveal;
uniform float uGrain;
uniform float uGlow;
uniform vec2 uTilt;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 9.1; a *= 0.5; } return s; }
void main() {
  vec2 uv = vUv;
  vec2 w = vec2(fbm(uv * 3.0 + vec2(uTime * 0.07, 0.0)), fbm(uv * 3.0 + vec2(3.1, uTime * 0.06))) - 0.5;
  uv += w * 0.03 * uFlow;
  vec2 d = (uv - 0.5);
  float s = uSplit * (0.4 + length(d) * 1.2);
  vec3 col = vec3(
    texture2D(map, uv + vec2(s, 0.0)).r,
    texture2D(map, uv).g,
    texture2D(map, uv - vec2(s, 0.0)).b
  );
  // dissolve in from the fog
  float n = fbm(vUv * 6.0 + 2.0);
  float edge = uReveal * 1.25 - 0.12;
  float a = smoothstep(n - 0.06, n + 0.02, edge);
  if (a < 0.01) discard;
  float rim = smoothstep(n - 0.02, n + 0.1, edge) - smoothstep(n + 0.1, n + 0.22, edge);
  col += (1.0 - smoothstep(0.0, 1.0, a)) * 0.0;
  col = mix(col * 0.12, col, smoothstep(0.0, 0.8, uReveal));
  col += vec3(0.9, 0.55, 0.3) * rim * (1.0 - uReveal) * 0.9;
  // soft sheen following the tilt
  float sheen = pow(max(0.0, 1.0 - length(vUv - (0.5 + uTilt * 0.5)) * 1.5), 3.0);
  col += sheen * 0.12 * uGlow;
  // paper edge
  float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  col *= 0.8 + 0.2 * smoothstep(0.0, 0.02, e);
  col += (hash(vUv * 900.0 + floor(uTime * 24.0)) - 0.5) * 0.06 * uGrain;
  gl_FragColor = vec4(col * (1.0 + uGlow * 0.15), a);
}
`

export function createArtworkMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: false,
    side: THREE.FrontSide,
    uniforms: {
      map: { value: map },
      uTime: { value: 0 },
      uFlow: { value: 0.2 },
      uSplit: { value: 0.002 },
      uReveal: { value: 1 },
      uGrain: { value: 1 },
      uGlow: { value: 0 },
      uBulge: { value: 0 },
      uTilt: { value: new THREE.Vector2() },
    },
  })
}

/* ─────────────── fragment assembly: the sleeve arrives as an N×N field of tiles ─────────────── */
const tileVert = /* glsl */ `
attribute vec3 aRand;
attribute vec2 aTile;
uniform float uAsm;
uniform float uN;
uniform float uTime;
varying vec2 vUv;
varying vec2 vLocal;
varying float vT;
varying float vR;
mat3 rotAxis(vec3 a, float ang){ a = normalize(a); float c = cos(ang), s = sin(ang), t = 1.0 - c;
  return mat3(t*a.x*a.x+c, t*a.x*a.y+s*a.z, t*a.x*a.z-s*a.y, t*a.x*a.y-s*a.z, t*a.y*a.y+c, t*a.y*a.z+s*a.x, t*a.x*a.z+s*a.y, t*a.y*a.z-s*a.x, t*a.z*a.z+c); }
void main(){
  float st = aRand.x * 0.42;
  float t = clamp((uAsm - st) / 0.58, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 c = instanceMatrix[3].xyz;
  vec3 loc = position;
  float k = 1.0 - t;
  vec3 axis = aRand * 2.0 - 1.0 + vec3(0.0, 0.0, 0.3);
  mat3 R = rotAxis(axis, k * (2.4 + aRand.z * 3.0) + sin(uTime * 0.6 + aRand.x * 9.0) * 0.18 * k);
  vec3 off = (aRand - 0.5) * vec3(3.2, 2.4, 5.0) * k * k + vec3(sin(uTime * 0.5 + aRand.y * 20.0) * 0.18, cos(uTime * 0.4 + aRand.z * 17.0) * 0.14, 0.0) * k;
  vec3 p = c + R * loc + off;
  vUv = (aTile + uv) / uN;
  vLocal = uv;
  vT = t;
  vR = aRand.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const tileFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vLocal;
varying float vT;
varying float vR;
uniform sampler2D map;
uniform float uTime;
uniform float uSplit;
uniform float uFlow;
uniform float uAsm;
uniform float uGlow;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  float k = 1.0 - vT;
  vec2 w = vec2(sin(vUv.y * 40.0 + uTime * 1.3 + vR * 6.0), cos(vUv.x * 36.0 - uTime * 1.1 + vR * 9.0)) * 0.006 * k;
  float s = uSplit * 0.5 + k * 0.03 * (0.4 + vR);
  vec2 uv = vUv + w;
  vec3 col = vec3(texture2D(map, uv + vec2(s, 0.0)).r, texture2D(map, uv).g, texture2D(map, uv - vec2(s, 0.0)).b);
  float a = smoothstep(0.0, 0.2, uAsm * 1.5 - vR * 0.4);
  if (a < 0.02) discard;
  float e = min(min(vLocal.x, 1.0 - vLocal.x), min(vLocal.y, 1.0 - vLocal.y));
  col *= mix(0.25, 1.0, smoothstep(0.0, 0.85, vT));
  col += vec3(0.55, 0.75, 1.0) * k * smoothstep(0.08, 0.0, e) * 0.9;
  col += (hash(vUv * 700.0 + floor(uTime * 24.0)) - 0.5) * 0.05;
  gl_FragColor = vec4(col * (1.0 + uGlow * 0.15), 1.0);
}
`
export function createTileMaterial(map: THREE.Texture, n: number) {
  return new THREE.ShaderMaterial({
    vertexShader: tileVert,
    fragmentShader: tileFrag,
    side: THREE.DoubleSide,
    uniforms: { map: { value: map }, uAsm: { value: 0 }, uN: { value: n }, uTime: { value: 0 }, uSplit: { value: 0.002 }, uFlow: { value: 0 }, uGlow: { value: 0 } },
  })
}
