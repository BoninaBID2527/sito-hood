import { alterco, artist, dualismo, pad, trackLabel } from '@/data/project'
import { linksFor } from '@/data/streaming'

/**
 * Real, readable DOM for crawlers, screen readers and no-WebGL fallbacks.
 * Visually hidden (the WebGL world is the visual layer) but always in the accessibility tree.
 */
export function SemanticContent() {
  const links = linksFor('alterco')
  return (
    <div className="sr-only">
      <h1>{artist.name} — {alterco.title}</h1>
      <p>
        {alterco.title}: {alterco.meta.trackCount} tracks, {alterco.meta.minutes} minutes. An interactive journey through
        the world of the project. Scroll to move through the alley, the seven tracks and the rooftop.
      </p>
      <h2>Tracklist</h2>
      <ol>
        {alterco.tracks.map((t) => (
          <li key={t.id}>{pad(t.n)} — {trackLabel(t)}</li>
        ))}
      </ol>
      {links.length > 0 && (
        <ul>
          {links.map((l) => (
            <li key={l.service}><a href={l.url}>{l.label}</a></li>
          ))}
        </ul>
      )}
      <h2>{dualismo.title}</h2>
      <p>A hidden 2-track project: {dualismo.tracks.map(trackLabel).join(', ')}.</p>
    </div>
  )
}
