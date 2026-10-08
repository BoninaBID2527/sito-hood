import * as THREE from 'three'

/** Mid/background architecture uses shared baked noise and regular PBR lighting.
 * Two low-frequency samples replace the hero material's many surface-life
 * lookups. Openings/relief, real texture scale and the world deformation remain.
 * No separate light, render pass, texture allocation or draw is introduced. */
export function backgroundMaterial(
  m: THREE.MeshStandardMaterial,
  uniforms: Record<string, { value: unknown }>,
  opts: { bump?: THREE.Texture; seed?: number; macro?: number },
) {
  if (opts.bump) { m.bumpMap = opts.bump; m.bumpScale = .008 }
  const seed = (opts.seed ?? 0).toFixed(2), macro = (opts.macro ?? 1).toFixed(2)
  const metal = m.metalness > .25
  m.userData.background = true
  // Background keeps the primary sun, directional sky fill and hemisphere.
  // Additional directional bounces and local light loops are represented by
  // the low-frequency irradiance fields below, not evaluated as full BRDFs.
  let lights = THREE.ShaderChunk.lights_fragment_begin.replace(
    /#if \( NUM_(POINT|SPOT|RECT_AREA)_LIGHTS > 0 \) && defined\( RE_Direct(?:_RectArea)? \)/g,
    '#if 0',
  )
  const start = lights.indexOf('#if ( NUM_DIR_LIGHTS > 0 )')
  const end = lights.indexOf('#if 0', start)
  const directional = lights.slice(start, end)
    .replace('for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {', 'for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n #if ( UNROLLED_LOOP_INDEX < 2 )')
    .replace('\n\t}\n\t#pragma unroll_loop_end', '\n #endif\n\t}\n\t#pragma unroll_loop_end')
  lights = lights.slice(0, start) + directional + lights.slice(end)
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBackgroundPosition;
        attribute float backgroundBounce; varying float vBackgroundBounce;
        uniform float uTime, uContam, uDissolve;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.);
        #else
          vec4 wp = modelMatrix * vec4(transformed, 1.);
        #endif
        vBackgroundPosition = wp.xyz;
        vBackgroundBounce = backgroundBounce;
        float wave = sin(wp.y*.9 + wp.z*.45 + uTime*1.1) * sin(wp.x*1.3 + uTime*.7);
        transformed += normal * wave * .07 * uContam * uContam;
        transformed += normal * sin(wp.y*.55 + wp.z*.31 + uTime*.4) * .35 * uDissolve * uDissolve;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBackgroundPosition;
        varying float vBackgroundBounce;
        uniform sampler2D uNz;
        uniform float uWet, uSunY, uSunAmt;
        uniform vec3 uSunCol, uSkyTop, uSkyHor;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 bp = vBackgroundPosition;
        vec2 broad = textureLod(uNz, (bp.xy + bp.z*vec2(.3173,.5411))*.009 + ${seed}, 0.).rg;
        vec2 meso = textureLod(uNz, vec2(bp.x+bp.z, bp.y)*vec2(.055,.008) + ${seed}*.17, 0.).rg;
        float damp = (1. - smoothstep(.1, 1.3, bp.y)) * uWet;
        diffuseColor.rgb *= mix(vec3(1.), mix(vec3(.91,.94,1.02), vec3(1.06,1.,.92), broad.r), ${macro});
        diffuseColor.rgb *= 1. + (meso.r-.5)*.14*${macro};
        diffuseColor.rgb *= 1. - damp*.22 - smoothstep(.62,.94,meso.g)*.12*${macro};
        diffuseColor.rgb *= .55 + .45*smoothstep(.015,.25,bp.y);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (broad.g-.5)*.09 - damp*.07, .18, 1.);`)
      .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment
        // View-space derivatives retain metre scale; the supplied height
        // range is 8 mm. Degenerate/clipped derivatives keep geometric normal.
        .replace('normalize( dFdx( surf_pos.xyz ) )', 'dFdx( surf_pos.xyz )')
        .replace('normalize( dFdy( surf_pos.xyz ) )', 'dFdy( surf_pos.xyz )')
        .replace('vec3 vGrad = sign( fDet )', 'if ( !( abs( fDet ) > 1e-12 ) ) return surf_norm;\n vec3 vGrad = sign( fDet )'))
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        vec3 bn = inverseTransformDirection(normal, viewMatrix);
        float band = smoothstep(uSunY-3.5, uSunY+1., bp.y) * uSunAmt;
        vec3 bounce = mix(uSkyHor,uSkyTop,.55)*.075 + uSunCol*vec3(1.,.68,.46)*band*.11;
        bounce += vec3(.55,.32,.16)*vBackgroundBounce*(1.+.5*(1.-uSunAmt));
        reflectedLight.indirectDiffuse += bounce * material.diffuseColor * (1./3.14159265);
        ${metal ? `vec3 direction = inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix);
        vec3 sky = mix(uSkyHor,uSkyTop,smoothstep(.0,.8,direction.y));
        sky *= mix(.25,1.,smoothstep(-.3,.2,direction.y));
        vec3 fresnel = material.specularColor + (vec3(1.)-material.specularColor)*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),5.);
        reflectedLight.indirectSpecular += sky * fresnel * mix(.28,.09,roughnessFactor);` : ''}`)
      .replace('#include <opaque_fragment>', `
        if (any(isnan(outgoingLight)) || any(isinf(outgoingLight))) {
          outgoingLight = vec3(0.);
          if (!any(isnan(totalDiffuse)) && !any(isinf(totalDiffuse))) outgoingLight += totalDiffuse;
          if (!any(isnan(totalSpecular)) && !any(isinf(totalSpecular))) outgoingLight += totalSpecular;
          if (!any(isnan(totalEmissiveRadiance)) && !any(isinf(totalEmissiveRadiance))) outgoingLight += totalEmissiveRadiance;
        }
        #include <opaque_fragment>`)
  }
  m.customProgramCacheKey = () => `background-pbr-v37-lights2-${seed}-${macro}-${metal}-${!!opts.bump}`
  return m
}
