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
