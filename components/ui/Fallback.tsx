import { alterco, artist, dualismo, pad, trackLabel } from '@/data/project'
import { linksFor } from '@/data/streaming'

/** Shown only when WebGL is unavailable. Same content, no 3D. */
export function Fallback() {
  const links = linksFor('alterco')
  return (
    <div className="fallback">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={alterco.artwork.webp} alt="ALTERCO — official artwork" width={alterco.artwork.width} height={alterco.artwork.height} />
      <div>
        <p className="label">{artist.name}</p>
        <h1 className="display">{alterco.title}</h1>
        <ol>
          {alterco.tracks.map((t) => (
            <li key={t.id}><i className="label">{pad(t.n)}</i> {trackLabel(t)}</li>
          ))}
        </ol>
        <p className="label">{alterco.meta.trackCount} TRACKS · {alterco.meta.minutes} MIN</p>
        {links.length > 0 && (
          <p className="fb-links">{links.map((l) => <a key={l.service} className="cta-link" href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}</p>
        )}
        <p className="label dim">+ {dualismo.title}: {dualismo.tracks.map(trackLabel).join(' / ')}</p>
        <p className="label dim">This experience needs WebGL. Try a recent browser or device.</p>
      </div>
    </div>
  )
}
