'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from '@/lib/timeOfDay'
import { rt } from '@/lib/runtime'

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the far plane
}
`
const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uTop, uMid, uHor, uSun;
uniform float uStars, uGlow, uTime, uContam, uMirror;
uniform vec3 uSunDir;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float hash2(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.02+7.1; a*=.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y * (1.0 - 2.0 * uMirror);
  float t = smoothstep(-0.05, 0.75, h);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.28, h));
  col = mix(col, uTop, smoothstep(0.2, 0.9, h));
  // sun / afterglow
  float s = max(dot(d, uSunDir), 0.0);
  col += uSun * (pow(s, 6.0) * 0.55 + pow(s, 48.0) * 1.2) * uGlow;
  // long sunset cloud streaks
  vec2 cuv = vec2(d.x / (abs(h) + 0.25), d.z / (abs(h) + 0.25)) * 1.4;
  float cl = fbm(cuv * vec2(1.0, 3.5) + vec2(uTime * 0.004, 0.0));
  float cm = smoothstep(0.45, 0.8, cl) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.35, 0.7, h));
  col = mix(col, uSun * 0.9 + uMid * 0.4, cm * 0.35 * uGlow);
  // stars
  if (uStars > 0.01 && h > 0.02) {
    vec3 sp = floor(d * 260.0);
    float st = step(0.9965, hash(sp));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sp) * 40.0);
    col += st * tw * uStars * smoothstep(0.02, 0.35, h);
  }
  // contamination: faint chromatic banding like the artwork
  col += uContam * 0.04 * (0.5 + 0.5 * cos(6.283 * (vec3(0.0, 0.33, 0.67) + h * 3.0)));
  gl_FragColor = vec4(col, 1.0);
}
`

export function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: THREE.BackSide,
        // V3.5: drawn LAST among the opaque objects, depth-tested at the far plane → the (fbm-heavy) sky shader only runs for the few pixels
        // that are really sky instead of being shaded for the whole screen and then painted over by walls
        depthWrite: false,
        depthTest: true,
        fog: false,
        toneMapped: false,
        uniforms: {
          uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
          uSun: { value: new THREE.Color() }, uStars: { value: 0 }, uGlow: { value: 1 }, uTime: { value: 0 },
          uContam: { value: 0 }, uMirror: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.18, 0.06, -1).normalize() },
        },
      }),
    [],
  )
  useFrame(({ camera }) => {
    const u = mat.uniforms
    if (rt.world === 'dualism') {
      u.uTop.value.set('#04051a')
      u.uMid.value.set('#10154a')
      u.uHor.value.set('#27409c')
      u.uSun.value.set('#5a8cff')
      u.uStars.value = 0.55
      u.uGlow.value = 0.28
    } else {
      u.uTop.value.copy(palette.skyTop)
      u.uMid.value.copy(palette.skyMid)
      u.uHor.value.copy(palette.horizon)
      u.uSun.value.copy(palette.sun)
      u.uStars.value = palette.stars
      u.uGlow.value = palette.glow
    }
    u.uTime.value = rt.time
    u.uContam.value = rt.fx.contam
    u.uMirror.value = rt.mirror
    if (mesh.current) {
      mesh.current.position.copy(camera.position)
      // the room is enclosed and DUALISMO paints its own backdrop (DualismoWorld): no sky pass at all in either
      const show = rt.world !== 'room' && rt.world !== 'dualism'
      if (mesh.current.visible !== show) mesh.current.visible = show
    }
  }, -1)
  return (
    <mesh ref={mesh} renderOrder={1000} frustumCulled={false} material={mat}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  )
}
