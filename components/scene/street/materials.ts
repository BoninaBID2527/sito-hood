import * as THREE from 'three'

/** Shared uniforms for every "street" surface (sunlit band, grime AO, wetness, ALTERCO contamination). */
export const streetU = {
  uTime: { value: 0 },
  uSunY: { value: 20 },
  uSunAmt: { value: 0 },
  uSunCol: { value: new THREE.Color('#ffb066') },
  uContam: { value: 0 },
  /** 0..1 — how wet the walls / ground read as the journey progresses (rising damp, shine) */
  uWet: { value: 0.35 },
  /** 0..1 — DUALISMO threshold: street loses material solidity (spectral split, dissolve) */
  uDissolve: { value: 0 },
  /** 0..1 — how much standing water has gathered (puddle threshold falls along the journey) */
  uPud: { value: 0 },
  /** 1 = fine micro-surface detail (aggregate, pitting) on the street materials; 0 on the mobile tier */
  uMicro: { value: 1 },
}

const GLSL_UTIL = /* glsl */ `
float h21_(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  h22_(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float h31_(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn2_(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21_(i), h21_(i+vec2(1,0)), f.x), mix(h21_(i+vec2(0,1)), h21_(i+vec2(1,1)), f.x), f.y); }
float vn3_(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(h31_(i), h31_(i+vec3(1,0,0)), f.x), mix(h31_(i+vec3(0,1,0)), h31_(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31_(i+vec3(0,0,1)), h31_(i+vec3(1,0,1)), f.x), mix(h31_(i+vec3(0,1,1)), h31_(i+vec3(1,1,1)), f.x), f.y), f.z); }
vec3 bumpN_(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec3 R1 = cross(sy, surf_norm), R2 = cross(surf_norm, sx);
  float fDet = dot(sx, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`

export interface StreetOpts {
  aoBase?: number
  /** brick-like tiling surface: per-cell bond offsets (breaks the 2.4 m repeat), patched masonry, painted-over panels */
  brick?: boolean
  /** height texture sampled with the same (offset) uv → screen-space bump */
  bump?: THREE.Texture
  bumpAmt?: number
  /** widen the height-sample footprint (suppresses glitter on fine-grain textures like asphalt) */
  bumpBlur?: number
  /** 0..1 strength of macro tint / grime / drips (default 1) */
  macro?: number
  seed?: number
  /** instanced atlas decal: per-instance uv rect (aRect) + bend/curl/rand (aMeta); local uv in vLoc */
  atlas?: boolean
  /** painted-on-wall decal: edge chipping, per-brick opacity breakup so it reads as paint/paper on masonry */
  decal?: boolean
  /** cloth flutter amplitude (metres) — hangs from uv.y = 1 */
  flutter?: number
  /** wetness field texture (R depth, G damp, B oil) in street world space — asphalt only */
  wet?: THREE.Texture
  /** world-space window the wet texture covers: [centreX, halfWidth, zNear, zFar] (default = the street) */
  wetBox?: [number, number, number, number]
}

export function patchStreet(m: THREE.MeshStandardMaterial, opts: StreetOpts = {}) {
  const ao = (opts.aoBase ?? 0.5).toFixed(2)
  const macro = (opts.macro ?? 1).toFixed(2)
  const seed = (opts.seed ?? 0).toFixed(1)
  const brick = !!(opts.brick && m.map)
  const bump = !!(opts.bump && m.map)
  const wet = !!opts.wet
  const decal = !!opts.decal
  const atlas = !!opts.atlas
  const metal = (m.metalness ?? 0) > 0.25
  const flut = (opts.flutter ?? 0).toFixed(3)
  const bumpAmt = (opts.bumpAmt ?? 1.2).toFixed(2)
  const bblur = (opts.bumpBlur ?? 1).toFixed(2)
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, streetU)
    if (bump) sh.uniforms.uBumpTex = { value: opts.bump }
    if (wet) {
      sh.uniforms.uWetTex = { value: opts.wet }
      sh.uniforms.uWetBox = { value: new THREE.Vector4(...(opts.wetBox ?? [0, 14, 20, -122])) }
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uContam;\nuniform float uDissolve;${opts.flutter ? '\nattribute float aHang;' : ''}${atlas ? '\nattribute vec4 aRect;\nattribute vec3 aMeta;\nvarying vec2 vLoc;' : ''}`)
      .replace('#include <uv_vertex>', atlas ? '#include <uv_vertex>\n  vLoc = vMapUv;\n  vMapUv = aRect.xy + vMapUv * aRect.zw;' : '#include <uv_vertex>')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
${
  atlas
    ? `  {
    // paper is never flat: it bows between its glue lines and a corner lifts
    float bw_ = aMeta.x * sin(uv.x * 3.14159) * (0.4 + 0.6 * sin(uv.y * 3.14159));
    float cu_ = smoothstep(0.62, 1.0, dot(uv, vec2(0.62, 0.78)));
    transformed.z += bw_ + aMeta.z * cu_ * cu_ + aMeta.x * 0.18 * sin(uv.y * 11.0 + aMeta.y * 40.0);
  }`
    : ''
}
#ifdef USE_INSTANCING
  vec4 wp_ = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
  vec4 wp_ = modelMatrix * vec4(transformed, 1.0);
#endif
  float wv_ = sin(wp_.y * 0.9 + wp_.z * 0.45 + uTime * 1.1) * sin(wp_.x * 1.3 + uTime * 0.7);
  transformed += normal * wv_ * 0.07 * uContam * uContam;
  transformed += normal * sin(wp_.y * 0.55 + wp_.z * 0.31 + uTime * 0.4) * 0.35 * uDissolve * uDissolve;
  vWPos = wp_.xyz;
${
  opts.flutter
    ? `  float fl_ = aHang;
  transformed.x += sin(uTime * 1.3 + wp_.z * 0.8 + wp_.x * 0.5) * ${flut} * fl_ * fl_;
  transformed.z += sin(uTime * 0.9 + wp_.x * 1.1) * ${flut} * 0.7 * fl_;`
    : ''
}`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
${atlas ? 'varying vec2 vLoc;' : ''}
uniform float uTime;
uniform float uContam;
uniform float uSunY;
uniform float uSunAmt;
uniform float uWet;
uniform float uDissolve;
uniform float uPud;
uniform float uMicro;
uniform vec3 uSunCol;
${wet ? 'uniform sampler2D uWetTex;\nuniform vec4 uWetBox;' : ''}
${bump ? 'uniform sampler2D uBumpTex;' : ''}
${GLSL_UTIL}`,
      )
      .replace(
        '#include <map_fragment>',
        brick || bump
          ? `#ifdef USE_MAP
  vec2 tuv_ = vMapUv;
${
  brick
    ? `  vec2 cell_ = floor(tuv_);
  vec2 hh_ = h22_(cell_ + vec2(${seed}, ${seed} * 1.7));
  tuv_.x += floor(hh_.x * 11.0) / 11.0;
  if (hh_.y > 0.5) tuv_.x = -tuv_.x; // mirrored tile: bond stays aligned, the pattern does not repeat
  tuv_.y += floor(hh_.y * 16.0) * 2.0 / 32.0;`
    : ''
}
  vec2 gx_ = dFdx(vMapUv), gy_ = dFdy(vMapUv);
  vec4 sampledDiffuseColor = textureGrad(map, tuv_, gx_, gy_);
  diffuseColor *= sampledDiffuseColor;
#endif`
          : '#include <map_fragment>',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float h_ = vWPos.y;
  float tang_ = vWPos.x + vWPos.z;
  float mac_ = ${macro};
  // ── macro variation: warm/cool brick lots, soot, damp, drips ──
  float nL_ = vn3_(vWPos * vec3(0.16, 0.12, 0.16) + ${seed});
  float nM_ = vn3_(vWPos * vec3(0.62, 0.5, 0.62) + 17.0);
  float nS_ = vn3_(vWPos * 3.1 + 5.0);
  vec3 lotTint_ = mix(vec3(0.80, 0.88, 1.02), vec3(1.14, 1.0, 0.86), smoothstep(0.25, 0.75, nL_));
  diffuseColor.rgb *= mix(vec3(1.0), lotTint_, mac_);
  diffuseColor.rgb *= 1.0 + (nM_ - 0.5) * 0.55 * mac_;
  diffuseColor.rgb *= 1.0 + (nS_ - 0.5) * 0.18 * mac_;
  // rising damp + splash zone
  float damp_ = (1.0 - smoothstep(0.15, 1.1 + nM_ * 1.3, h_)) * (0.35 + 0.65 * uWet);
  diffuseColor.rgb *= 1.0 - 0.45 * damp_ * mac_;
  // drip streaks running down from ledges / pipes
  float st_ = vn2_(vec2(tang_ * 5.5, h_ * 0.16 + nL_ * 3.0));
  st_ = smoothstep(0.62, 0.95, st_) * smoothstep(0.3, 6.0, h_) * (0.5 + 0.5 * vn2_(vec2(tang_ * 0.9, h_ * 0.05)));
  diffuseColor.rgb *= 1.0 - 0.38 * st_ * mac_;
  float pt_ = 0.0;
  float puddle_ = 0.0, dampG_ = 0.0;
  float brickRough_ = 1.0;
  float asphaltPolish_ = 0.0, asphaltCrack_ = 0.0;
  float rustM_ = 0.0;
  float grime_ = smoothstep(0.45, 0.85, vn3_(vWPos * vec3(0.9, 0.25, 0.9) + 31.0)) * smoothstep(1.5, 12.0, h_);
  diffuseColor.rgb *= 1.0 - 0.28 * grime_ * mac_;
  // micro-surface (V3.4): fine aggregate / pitting that lives below the texture's resolution. Fades out with distance, so it never
  // shimmers and costs nothing where it cannot be seen (uMicro = 0 on the mobile tier).
  float microR_ = 0.0;
  if (uMicro > 0.5) {
    float fdm_ = 1.0 - smoothstep(5.0, 15.0, length(vViewPosition));
    if (fdm_ > 0.01) {
      float mi_ = (vn3_(vWPos * 34.0 + 11.0) * 0.6 + vn3_(vWPos * 97.0 + 23.0) * 0.4) - 0.5;
      diffuseColor.rgb *= 1.0 + mi_ * 0.34 * fdm_ * mac_;
      microR_ = mi_ * 0.3 * fdm_ * mac_;
    }
  }
${
  brick
    ? `  // patched masonry / painted-over panels
  vec2 pc_ = vec2(tang_, h_) / vec2(2.9, 1.9);
  vec2 pi_ = floor(pc_);
  float ph_ = h21_(pi_ + ${seed});
  vec2 pf_ = fract(pc_) - 0.5;
  float pm_ = smoothstep(0.5, 0.42, max(abs(pf_.x) * 1.0, abs(pf_.y) * 1.0) + (vn2_(pc_ * 6.0) - 0.5) * 0.22);
  pt_ = step(ph_, 0.10) * pm_;
  vec3 paint_ = mix(vec3(0.34, 0.30, 0.27), vec3(0.22, 0.27, 0.27), h21_(pi_ + 3.1));
  if (h21_(pi_ + 9.7) > 0.7) paint_ = vec3(0.45, 0.40, 0.30);
  diffuseColor.rgb = mix(diffuseColor.rgb, paint_ * (0.8 + nS_ * 0.4), pt_ * 0.92 * mac_);
  // each brick has its own life: kiln tone, a few burnt, a few pale, slightly different roughness
  {
    float row2_ = floor(tuv_.y * 32.0);
    float col2_ = floor(tuv_.x * 11.0 + 0.5 * mod(row2_, 2.0));
    vec2 bid_ = vec2(col2_, row2_) + floor(vMapUv) * 17.0 + ${seed};
    float b1_ = h21_(bid_), b2_ = h21_(bid_ + 7.7), b3_ = h21_(bid_ + 3.1);
    vec3 bt_ = mix(vec3(0.80, 0.76, 0.78), vec3(1.16, 1.0, 0.88), b1_) * (0.78 + 0.44 * b2_);
    diffuseColor.rgb *= mix(vec3(1.0), bt_, 0.8 * mac_ * (1.0 - pt_));
    diffuseColor.rgb *= mix(1.0, 0.5, step(0.94, b3_) * mac_);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.18, 1.05), step(b3_, 0.04) * mac_ * 0.7);
    brickRough_ = 0.82 + 0.3 * b2_;
    // efflorescence / salt bloom low on the wall, pale mineral stains
    float salt_ = smoothstep(0.55, 0.82, vn3_(vWPos * vec3(1.6, 0.7, 1.6) + 9.0)) * (1.0 - smoothstep(0.3, 2.6, h_));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.55) * (0.7 + 0.5 * nS_), salt_ * 0.28 * mac_ * (1.0 - pt_));
    // dirt gathers in the mortar-scale noise: darker, rougher pockets
    float pocket_ = smoothstep(0.6, 0.9, vn3_(vWPos * vec3(7.0, 5.0, 7.0) + 3.0));
    diffuseColor.rgb *= 1.0 - 0.18 * pocket_ * mac_;
  }`
    : ''
}
${
  wet
    ? `  {
    vec2 wuv_ = vec2((vWPos.x - uWetBox.x) / (uWetBox.y * 2.0) + 0.5, (uWetBox.z - vWPos.z) / (uWetBox.z - uWetBox.w));
    float inside_ = step(0.0, wuv_.x) * step(wuv_.x, 1.0) * step(0.0, wuv_.y) * step(wuv_.y, 1.0);
    vec3 wf_ = texture2D(uWetTex, wuv_).rgb;
    float pn_ = vn2_(vWPos.xz * 6.0) * 0.6 + vn2_(vWPos.xz * 19.0) * 0.4;
    float thr_ = mix(0.66, 0.2, uPud);
    puddle_ = smoothstep(thr_ - 0.06, thr_ + 0.03, wf_.r + (pn_ - 0.5) * 0.16) * inside_;
    dampG_ = clamp(wf_.g + (pn_ - 0.5) * 0.4 - 0.12 + uPud * 0.18, 0.0, 1.0) * inside_ + (1.0 - inside_) * 0.35;
    dampG_ = max(dampG_, puddle_) * (0.55 + 0.45 * uWet);
    // repair patches (tar, sharper edges), fine ridged cracks, polished tyre lanes
    vec2 ap_ = vWPos.xz / vec2(3.4, 4.8);
    vec2 ai_ = floor(ap_);
    float ah_ = h21_(ai_ + 3.3);
    vec2 af_ = fract(ap_) - 0.5;
    float patch_ = step(ah_, 0.14) * smoothstep(0.5, 0.45, max(abs(af_.x) * 0.95, abs(af_.y)) + (vn2_(ap_ * 9.0) - 0.5) * 0.07) * inside_;
    diffuseColor.rgb *= 1.0 - 0.3 * patch_;
    float cr_ = 1.0 - abs(vn2_(vWPos.xz * vec2(1.3, 0.9) + 7.0) * 2.0 - 1.0);
    float cr2_ = 1.0 - abs(vn2_(vWPos.xz * vec2(3.1, 2.3) + 21.0) * 2.0 - 1.0);
    float crack_ = max(smoothstep(0.972, 0.992, cr_), smoothstep(0.985, 0.996, cr2_) * 0.7) * inside_;
    diffuseColor.rgb *= 1.0 - 0.6 * crack_ * (1.0 - puddle_);
    float lane_ = exp(-pow((abs(vWPos.x - 0.1) - 0.95 + (vn2_(vWPos.zz * 0.4) - 0.5) * 0.3) * 3.2, 2.0)) * smoothstep(-70.0, 16.0, vWPos.z) * step(vWPos.z, 20.0);
    diffuseColor.rgb *= 1.0 - 0.14 * lane_;
    // the walls shade the road: a soft gradient toward both kerbs (street only, not the roof deck)
    float kerb_ = smoothstep(0.9, 2.9, abs(vWPos.x)) * smoothstep(-76.0, -68.0, vWPos.z) * step(13.5, uWetBox.y);
    diffuseColor.rgb *= 1.0 - 0.38 * kerb_;
    asphaltPolish_ = lane_ * 0.5 + patch_ * 0.3;
    asphaltCrack_ = crack_;
  }`
    : ''
}
${
  decal
    ? `  {
    float row_ = floor(h_ / 0.075);
    float bn_ = h21_(vec2(floor(tang_ / 0.218 + 0.5 * mod(row_, 2.0)), row_));
    float edge_ = (nS_ - 0.5) * 0.5 + (vn3_(vWPos * 9.0) - 0.5) * 0.3;
    diffuseColor.a *= smoothstep(0.32 + edge_, 0.62 + edge_, diffuseColor.a) * (0.84 + 0.16 * bn_);
    diffuseColor.rgb *= 0.86 + 0.2 * bn_;
    // paper / paint ageing: torn irregular edges, sun-bleach + grey, dirt gathering low, a lifted lip at the border
    vec2 du_ = ${atlas ? 'vLoc' : 'vMapUv'};
    float eg_ = min(min(du_.x, 1.0 - du_.x), min(du_.y, 1.0 - du_.y));
    float tn_ = vn2_(du_ * vec2(11.0, 14.0) + vWPos.zx * 0.9);
    diffuseColor.a *= smoothstep(0.0, 0.035 + 0.07 * tn_, eg_ - 0.006 * h21_(floor(vWPos.xz * 12.0 + vWPos.y * 3.0)));
    float age_ = vn2_(du_ * 3.0 + 5.0 + ${seed});
    vec3 gry_ = vec3(dot(diffuseColor.rgb, vec3(0.33)));
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(gry_, vec3(0.52, 0.48, 0.42), 0.35), 0.18 + 0.3 * age_);
    diffuseColor.rgb *= 0.74 + 0.26 * smoothstep(0.0, 0.55, du_.y + 0.35 * tn_);
    diffuseColor.rgb *= 0.8 + 0.2 * smoothstep(0.0, 0.045, eg_);
  }`
    : ''
}
${
  metal
    ? `  {
    float rn_ = vn3_(vWPos * 1.7 + 41.0) * 0.6 + vn3_(vWPos * 7.0 + 3.0) * 0.4;
    rustM_ = smoothstep(0.56, 0.8, rn_) * (0.45 + 0.55 * (1.0 - smoothstep(0.0, 5.0, h_))) * mac_;
    vec3 rustC_ = mix(vec3(0.36, 0.16, 0.07), vec3(0.2, 0.11, 0.08), vn3_(vWPos * 13.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, rustC_, rustM_ * 0.8);
    diffuseColor.rgb *= 0.78 + 0.44 * vn3_(vWPos * 23.0);
    // dust / dried water marks on horizontal-ish runs
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.29, 0.27), smoothstep(0.6, 0.85, vn3_(vWPos * vec3(3.0, 0.8, 3.0))) * 0.3 * mac_);
  }`
    : ''
}
  float wallAO_ = mix(${ao}, 1.0, smoothstep(0.0, 3.2, h_));
  diffuseColor.rgb *= wallAO_;
  vec3 irid_ = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + h_ * 0.06 + vWPos.z * 0.025 + uTime * 0.025));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.55 + irid_ * 0.95), uContam * uContam * 0.4);
  // DUALISMO threshold: material solidity bleeds into spectral bands
  vec3 spec_ = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vWPos.y * 0.09 + vWPos.z * 0.04 - uTime * 0.05));
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(dot(diffuseColor.rgb, vec3(0.33))), spec_ * 0.8, 0.5), uDissolve);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (0.88 + (nM_ - 0.5) * 0.5 * mac_ + st_ * 0.15) - damp_ * 0.38 * mac_ - uWet * 0.06 * (1.0 - smoothstep(0.0, 6.0, h_)), 0.3, 1.0);
  roughnessFactor *= brickRough_;
  roughnessFactor = clamp(roughnessFactor + microR_, 0.15, 1.0);
  roughnessFactor = clamp(roughnessFactor + rustM_ * 0.3, 0.2, 1.0);
  roughnessFactor = mix(roughnessFactor, mix(0.26 + nM_ * 0.2 + asphaltCrack_ * 0.3, 0.04, puddle_), dampG_ * 0.9);
  roughnessFactor = max(0.12, roughnessFactor - asphaltPolish_ * 0.14);`,
      )
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor *= 1.0 - rustM_ * 0.85;')
      .replace(
        '#include <normal_fragment_maps>',
        bump
          ? `#include <normal_fragment_maps>
  {
    vec2 kx_ = gx_ * ${bblur}, ky_ = gy_ * ${bblur};
    float b0_ = textureGrad(uBumpTex, tuv_, kx_, ky_).r;
    float bx_ = textureGrad(uBumpTex, tuv_ + kx_, kx_, ky_).r;
    float by_ = textureGrad(uBumpTex, tuv_ + ky_, kx_, ky_).r;
    normal = bumpN_(-vViewPosition, normal, vec2(bx_ - b0_, by_ - b0_) / ${bblur} * ${bumpAmt} * (1.0 - pt_ * 0.8) * (1.0 - puddle_ * 0.92) * (1.0 - smoothstep(0.0025, 0.011, max(length(gx_), length(gy_)))), faceDirection);
  }`
          : '#include <normal_fragment_maps>',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  float sun_ = smoothstep(uSunY - 3.5, uSunY + 1.0, h_) * uSunAmt;
  totalEmissiveRadiance += diffuseColor.rgb * uSunCol * sun_ * 1.5;`,
      )
  }
  m.customProgramCacheKey = () => `street2-${ao}-${macro}-${seed}-${brick ? 'b' : ''}${bump ? 'n' + bumpAmt + 'b' + bblur : ''}${wet ? 'w' : ''}${flut}${decal ? 'd' : ''}${atlas ? 'a' : ''}${metal ? 'm' : ''}5`
  return m
}

export function streetMat(params: THREE.MeshStandardMaterialParameters & StreetOpts) {
  const { aoBase, brick, bump, bumpAmt, bumpBlur, macro, seed, wet, wetBox, flutter, decal, atlas, ...rest } = params
  return patchStreet(new THREE.MeshStandardMaterial(rest), { aoBase, brick, bump, bumpAmt, bumpBlur, macro, seed, wet, wetBox, flutter, decal, atlas })
}

/** Gentle sway for cables / hanging objects. Amplitude fades toward the fixed ends (uv.x 0..1). */
export function patchSway(m: THREE.Material, amp = 0.05) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTimeS = { value: 0 }
    ;(m as any).userData.sw = sh.uniforms.uTimeS
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTimeS;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  float sw_ = sin(uv.x * 3.14159);
  float ph_ = (modelMatrix * vec4(position, 1.0)).z;
  transformed.y += sin(uTimeS * 1.3 + ph_ * 0.9) * ${amp.toFixed(3)} * sw_;
  transformed.x += sin(uTimeS * 0.9 + ph_ * 0.6) * ${(amp * 0.6).toFixed(3)} * sw_;`,
      )
  }
  m.customProgramCacheKey = () => 'sway'
  return m
}
