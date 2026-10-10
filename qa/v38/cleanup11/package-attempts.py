"""Retain interrupted evidence in WebP; keep original PNGs outside Git.

This only packages QA screenshots. It never reads/writes product assets.
"""
import hashlib, json, shutil
from pathlib import Path
from PIL import Image

q = Path(__file__).resolve().parent
raw = Path('/workspace/scratch/cleanup11-original-png/attempts')
records = []
for png in sorted((q / 'attempts').rglob('*.png')):
    rel = png.relative_to(q / 'attempts')
    saved = raw / rel
    saved.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(png, saved)
    webp = png.with_suffix('.webp')
    Image.open(png).convert('RGB').save(webp, quality=94, method=6)
    digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    records.append({'raw': str(rel), 'rawPngSha256': digest(png),
                    'image': str(webp.relative_to(q / 'attempts')),
                    'imageSha256': digest(webp)})
    png.unlink()
    manifest = webp.parent / 'manifest.json'
    if manifest.exists():
        m = json.loads(manifest.read_text())
        for c in m['captures']:
            if webp.stem == f"{c['n']:02}-{c['name']}":
                c.update(image=webp.name, rawPngSha256=records[-1]['rawPngSha256'],
                         imageSha256=records[-1]['imageSha256'])
        manifest.write_text(json.dumps(m, indent=2) + '\n')
out = q / 'attempts' / 'image-integrity.json'
previous = json.loads(out.read_text()) if out.exists() else []
out.write_text(json.dumps(previous + records, indent=2) + '\n')
print(f'Packaged {len(records)} interrupted QA images; raw originals retained outside Git')
