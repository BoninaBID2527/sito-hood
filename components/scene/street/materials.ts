import * as THREE from 'three'

/** Shared uniforms for every "street" surface (sunlit band, grime AO, ALTERCO contamination). */
export const streetU = {
  uTime: { value: 0 },
  uSunY: { value: 20 },
  uSunAmt: { value: 0 },
  uSunCol: { value: new THREE.Color('#ffb066') },
  uContam: { value: 0 },
}

export function patchStreet(m: THREE.MeshStandardMaterial, opts: { aoBase?: number } = {}) {
  const ao = (opts.aoBase ?? 0.5).toFixed(2)
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, streetU)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uContam;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec4 wp_ = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
  vec4 wp_ = modelMatrix * vec4(transformed, 1.0);
#endif
  float wv_ = sin(wp_.y * 0.9 + wp_.z * 0.45 + uTime * 1.1) * sin(wp_.x * 1.3 + uTime * 0.7);
  transformed += normal * wv_ * 0.07 * uContam * uContam;
  vWPos = wp_.xyz;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uContam;\nuniform float uSunY;\nuniform float uSunAmt;\nuniform vec3 uSunCol;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float h_ = vWPos.y;
  diffuseColor.rgb *= mix(${ao}, 1.0, smoothstep(0.0, 3.2, h_));
  vec3 irid_ = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + h_ * 0.06 + vWPos.z * 0.025 + uTime * 0.025));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.55 + irid_ * 0.95), uContam * uContam * 0.4);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  float sun_ = smoothstep(uSunY - 3.5, uSunY + 1.0, h_) * uSunAmt;
  totalEmissiveRadiance += diffuseColor.rgb * uSunCol * sun_ * 1.5;`,
      )
  }
  m.customProgramCacheKey = () => `street-${ao}`
  return m
}

export function streetMat(params: THREE.MeshStandardMaterialParameters & { aoBase?: number }) {
  const { aoBase, ...rest } = params
  return patchStreet(new THREE.MeshStandardMaterial(rest), { aoBase })
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
  transformed.y += sin(uTimeS * 1.3 + modelMatrix[3].z * 0.7) * ${amp.toFixed(3)} * sw_;
  transformed.x += sin(uTimeS * 0.9 + modelMatrix[3].z) * ${(amp * 0.6).toFixed(3)} * sw_;`,
      )
  }
  m.customProgramCacheKey = () => 'sway'
  return m
}
