import * as THREE from 'three'

/** One shared surround geometry/material, bounded by physical facade zone.
 * Each camera (including the sun and reflection cameras) culls independently.
 * No distance cutoff, LOD or quality-tier omission: all instances remain. */
export function windowSurroundBatches(
  matrices: THREE.Matrix4[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
) {
  const zones = new Map<string, THREE.Matrix4[]>()
  for (const matrix of matrices) {
    const x = matrix.elements[12], z = matrix.elements[14]
    const zone = z > -76 ? (z > -38 ? 'street-near' : 'street-far')
      : z > -118 ? `plaza-${x < 0 ? 'left' : 'right'}-${z > -100 ? 'front' : 'rear'}`
      : 'passage'
    if (!zones.has(zone)) zones.set(zone, [])
    zones.get(zone)!.push(matrix)
  }
  return [...zones].map(([zone, list]) => {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length)
    mesh.name = `window-surrounds-${zone}`
    mesh.castShadow = true
    list.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    // Street materials displace along the unit normal by at most .07 + .35 m
    // in local space during ALTERCO/DUALISMO. Wider/taller windows amplify
    // that offset, so include the largest instance scale in every camera's bound.
    const maxScale = Math.max(...list.map(({ elements: e }) => Math.max(
      Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]),
    )))
    mesh.boundingSphere!.radius += .42 * maxScale + .01
    return mesh
  })
}
