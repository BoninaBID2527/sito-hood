import * as THREE from 'three'

const vert = /* glsl */ `
varying vec2 vUv;
uniform float uBend;
uniform float uHover;
void main() {
  vUv = uv;
  vec3 p = position;
  float c = sin(uv.x * 3.14159);
  p.z += c * (uBend * 0.45 + uHover * 0.06);
  p.y += sin(uv.y * 3.14159) * uBend * 0.06;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D map;
uniform float uHover;
uniform float uFar;
uniform float uDim;
uniform float uRgb;
uniform float uAppear;
uniform float uNeg;
uniform float uLit;
uniform float uTime;
uniform vec2 uSheen;
uniform vec3 uFog;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  float bias = uFar * 2.6 * (1.0 - uHover);
  vec2 uv = vUv;
  vec4 t;
  if (uRgb > 0.0005) {
    t = vec4(texture2D(map, uv + vec2(uRgb, 0.0), bias).r, texture2D(map, uv, bias).g, texture2D(map, uv - vec2(uRgb, 0.0), bias).b, 1.0);
  } else {
    t = texture2D(map, uv, bias);
  }
  vec3 col = t.rgb;
  if (!gl_FrontFacing) {
    // seen from behind: the paper shows the print faintly through
    col = texture2D(map, vec2(1.0 - uv.x, uv.y), 2.0).rgb * 0.2 + 0.03;
  }
  float sheen = pow(max(0.0, 1.0 - distance(uv, uSheen) * 1.5), 2.5);
  col += sheen * uHover * 0.22 * vec3(1.0, 0.92, 0.8);
  if (uNeg > 0.5) col = (vec3(1.0) - col) * vec3(0.8, 0.9, 1.0) * 0.8;
  col *= 0.72 + 0.5 * uHover;
  col *= 1.0 + uLit * 0.45 * (1.0 - 0.5 * length(uv - 0.5));
  col *= mix(1.0, 0.5, uFar) * (1.0 - uDim * 0.62);
  col = mix(col, uFog * 0.7, uFar * 0.28);
  // dissolve in when the orbit assembles
  float n = hash(floor(uv * 60.0));
  float a = step(n * 0.9, uAppear * 1.1 - 0.05);
  if (a < 0.5) discard;
  float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  col *= 0.88 + 0.12 * smoothstep(0.0, 0.015, e);
  col += (hash(uv * 700.0 + floor(uTime * 24.0)) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}
`

export function createCardMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: map },
      uHover: { value: 0 },
      uFar: { value: 0 },
      uDim: { value: 0 },
      uRgb: { value: 0 },
      uBend: { value: 0 },
      uAppear: { value: 1 },
      uNeg: { value: 0 },
      uLit: { value: 0 },
      uTime: { value: 0 },
      uSheen: { value: new THREE.Vector2(0.5, 0.5) },
      uFog: { value: new THREE.Color('#444') },
    },
  })
}
