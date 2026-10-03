/**
 * Audio hooks. Nothing here autoplays — the engine only starts after an explicit click on ENTER.
 *
 * ▸ ambient: drop a licensed loop at /public/audio/ambient-city.mp3 and set the path below.
 *   While empty, a tiny synthesised room-tone (filtered noise, no music) is used instead.
 * ▸ previews: NOT provided. Left empty on purpose — no fake song previews are generated.
 */
export const audioConfig = {
  ambient: '' as string, // e.g. '/audio/ambient-city.mp3'
  previews: {} as Record<string, string>, // e.g. { 'alterco:potrei': '/audio/previews/potrei.mp3' }
}
