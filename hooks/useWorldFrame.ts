import { useFrame, type RenderCallback } from '@react-three/fiber'
import { rt } from '@/lib/runtime'

/**
 * `useFrame` that only runs while its world is the one on screen (section-based activation).
 * The alley, the rooftop and DUALISMO are separate worlds; when the visitor is in one of them the other two do no per-frame work
 * (their groups are hidden by WorldGate, so they already cost no draw calls — this removes the CPU side too).
 */
export function useWorldFrame(world: 'alley' | 'roof' | 'dualism' | 'room', cb: RenderCallback, priority = 0) {
  useFrame((s, d, f) => {
    if (rt.world === world) cb(s, d, f)
  }, priority)
}
