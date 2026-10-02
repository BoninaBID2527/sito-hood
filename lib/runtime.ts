import { SETTINGS, type QualitySettings } from './quality'

/**
 * Mutable, non-reactive per-frame state shared by the camera rig, the scene and the
 * post-processing pass. React never re-renders from this — it is read inside useFrame.
 */
export const rt = {
  /** raw scroll progress 0..1 (written by ScrollRig) */
  progress: 0,
  /** spring-smoothed progress used by the camera (small overshoot = mass) */
  smooth: 0,
  /** d(smooth)/dt, progress units / second */
  velocity: 0,
  /** time since last scroll movement (s) */
  idle: 0,
  /** pointer in NDC (-1..1), smoothed */
  px: 0,
  py: 0,
  /** raw pointer in NDC */
  rx: 0,
  ry: 0,
  /** pointer in px (for cursor/proximity maths) */
  mx: 0,
  my: 0,
  /** orientation tilt contribution (mobile, optional) */
  tx: 0,
  ty: 0,
  down: false,
  reducedMotion: false,
  touch: false,
  aspect: 1,
  width: 1,
  height: 1,
  time: 0,
  /** post / scene driven values — overwritten every frame by the timeline */
  fx: {
    rgb: 0, // chromatic aberration
    liquid: 0, // water pass-through
    tunnel: 0, // dualismo tunnel
    contam: 0, // ALTERCO contamination of the physical world
    fade: 1, // 1 = fully visible, 0 = black
    cut: 1, // reduced-motion crossfade multiplier
    glitch: 0,
    negative: 0,
    grain: 0.5,
    vignette: 0.5,
    exposure: 1,
    ripple: 0,
    rippleX: 0.5,
    rippleY: 0.5,
    focusDim: 0, // darkening while a track is focused
    dualism: 0, // 1 inside the Dualismo world (grade)
    blur: 0,
  },
  /** extra, transient post impulses (decay each frame) */
  impulse: { rgb: 0, glitch: 0 },
  /** entry fly-in 0..1 and dualismo arrival 0..1 (tweened by actions) */
  intro: { t: 0 },
  dual: { t: 0 },
  /** camera-space pointer kick used by interactions (units: metres) */
  push: 0,
  /** time-of-day mix evaluated from progress (see lib/timeOfDay) */
  night: 0,
  /** orbit state (see TrackOrbit) */
  orbit: { angle: 0, front: 0, vel: 0, drag: 0, hover: -1, resetDrag: false, err: 0 },
  /** the alley/roof/dualism world currently being rendered */
  world: 'alley' as 'alley' | 'roof' | 'dualism',
  quality: SETTINGS.medium as QualitySettings,
}

export type Runtime = typeof rt
