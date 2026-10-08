// Diagnostic readback after a capture/probe, outside any measured frame samples.
// Half-float exponent 31 represents NaN/Infinity; finite RGB must reach the mip chain.
export const reflectionHealth = page => page.evaluate(() => {
  const rows = []
  window.__scene.traverse(object => {
    if (object.material?.name !== 'PuddleReflector' || !object.getRenderTarget) return
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return
    const target = object.getRenderTarget(), renderer = window.__gl
    if (!renderer.properties.get(target).__webglFramebuffer) return
    const pixels = new Uint16Array(target.width * target.height * 4)
    renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels)
    let nonfinite = 0, nonzeroRGB = 0
    for (let i = 0; i < pixels.length; i++) {
      if ((pixels[i] & 0x7c00) === 0x7c00) nonfinite++
      if (i % 4 !== 3 && (pixels[i] & 0x7fff)) nonzeroRGB++
    }
    rows.push({ position: object.position.toArray(), size: [target.width, target.height], nonfinite, nonzeroRGB })
  })
  return rows
})
