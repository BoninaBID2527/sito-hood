/**
 * Streaming configuration — the ONLY place external URLs live.
 *
 * ▸ No links were supplied, so every entry is empty and the UI shows nothing for it.
 * ▸ Paste real URLs (https://…) to switch a service on. Services left '' are never rendered.
 * ▸ Per-track links override the project link for that track.
 */
export type Service = 'spotify' | 'appleMusic' | 'youtube'
export type LinkSet = Partial<Record<Service, string>>

export const serviceLabel: Record<Service, string> = {
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
  youtube: 'YouTube',
}

export const projectLinks: Record<'alterco' | 'dualismo', LinkSet> = {
  alterco: { spotify: '', appleMusic: '', youtube: '' },
  dualismo: { spotify: '', appleMusic: '', youtube: '' },
}

/** keyed by `${projectId}:${track.id}` e.g. "alterco:potrei" */
export const trackLinks: Record<string, LinkSet> = {
  // 'alterco:potrei': { spotify: 'https://open.spotify.com/track/…' },
}

export function activeLinks(set: LinkSet | undefined): { service: Service; label: string; url: string }[] {
  if (!set) return []
  return (Object.keys(serviceLabel) as Service[])
    .filter((s) => typeof set[s] === 'string' && set[s]!.startsWith('http'))
    .map((s) => ({ service: s, label: serviceLabel[s], url: set[s]! }))
}

export function linksFor(projectId: 'alterco' | 'dualismo', trackId?: string) {
  const own = trackId ? activeLinks(trackLinks[`${projectId}:${trackId}`]) : []
  return own.length ? own : activeLinks(projectLinks[projectId])
}
