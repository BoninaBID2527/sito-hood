"""Package inspected task-11 evidence; refuse missing/failed captures or suites.

Run from repository root after visual review and all recorded stages pass.
Raw PNG originals are retained outside Git; WebP copies only reduce QA payload.
No artist/product asset is transformed by this script.
"""
import hashlib, html, json, math, shutil
from pathlib import Path
from PIL import Image

q = Path(__file__).resolve().parent
root = q.parents[2]
raw = Path('/workspace/scratch/cleanup11-original-png')
raw.mkdir(parents=True, exist_ok=True)
def read(name): return json.loads((q / name).read_text())
def write(name, obj): (q / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

results = read('results.json')
expected_stages = {'after', 'before-oneway', 'before-room', 'after-room', 'no-post', 'after-high', 'picking', 'e2e', 'ROOM-desktop', 'eggs', 'secrets', 'tracks'}
assert {s['name'] for s in results['stages']} == expected_stages
assert all(s['exit'] == 0 for s in results['stages']), 'Unresolved failed suite'
recapture = read('video-camera-recapture.json')
assert len(recapture['stages']) == 2 and all(s['exit'] == 0 for s in recapture['stages']), 'Video camera recapture incomplete'
assert len(read('picking.json')['results']) == 14
assert not read('picking.json')['errors']
for f, sha in read('source.json')['implementationFiles'].items():
    assert digest(root / f) == sha, f'Source changed after verified build: {f}'

folders = {'before':54, 'before-extra':9, 'before-oneway':2, 'before-room':7, 'before-high-partial':5,
           'after':89, 'after-room':7, 'after-high':5, 'no-post':5}
all_captures = []
manifests = {}
for folder, count in folders.items():
    m = read(f'{folder}/manifest.json')
    assert len(m['captures']) == count and not m['errors'], folder
    assert m['buildId'] == (read('source.json')['baselineBuildId'] if folder.startswith('before') else results['buildId'])
    for c in m['captures']:
        assert all(r['nonfinite'] == 0 for r in c['reflections']), folder
        if folder in ['before-room', 'after-room'] and c['n'] == 45:
            assert c['stateAtShot'] and c['videoTime'] >= 4, 'Video metadata must describe the captured playing frame'
        png = q / folder / f"{c['n']:02}-{c['name']}.png"
        webp = png.with_suffix('.webp')
        if png.exists():
            saved = raw / folder / png.name
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(png, saved)
            Image.open(png).convert('RGB').save(webp, quality=94, method=6)
            c['rawPngSha256'] = digest(png)
            png.unlink()
        assert webp.exists(), webp
        c['image'] = webp.name
        c['imageSha256'] = digest(webp)
        all_captures.append({'folder':folder, **c})
    write(f'{folder}/manifest.json', m)
    manifests[folder] = m

pairs = []
for before, after in [('before','after'), ('before-extra','after'), ('before-oneway','after'), ('before-room','after-room'), ('before-high-partial','after-high')]:
    a = {c['n']:c for c in manifests[after]['captures']}
    for b in manifests[before]['captures']:
        c = a[b['n']]
        for key in ['viewport','quality','noPost','noFog']: assert manifests[before][key] == manifests[after][key], key
        for key in ['tier','scale','masonryWidth','world']: assert b[key] == c[key], key
        fov_delta = abs(b['camera']['fov'] - c['camera']['fov'])
        # Authored narrative station cameras retain tiny interpolation residuals.
        # Validate the actual lens-scale error in pixels, not float equality.
        # Director keeps a 0.01-degree projection-update deadband even when a
        # debug pose supplies FOV. Require matching requested inspection lenses
        # and bound the actual residual optically; never relabel captured data.
        width = int(manifests[before]['viewport'].split('x')[0])
        edge_lens_drift = width / 2 * abs(math.tan(math.radians(b['camera']['fov'] / 2)) /
                                         math.tan(math.radians(c['camera']['fov'] / 2)) - 1)
        assert edge_lens_drift < .1, (b['n'], edge_lens_drift)
        if b['inspectionCamera'] is not None or c['inspectionCamera'] is not None:
            assert b['inspectionCamera'] is not None and c['inspectionCamera'] is not None
            assert b['inspectionCamera']['fov'] == c['inspectionCamera']['fov'], 'Requested inspection lens changed'
        pos_delta = max(abs(x-y) for x,y in zip(b['camera']['position'],c['camera']['position']))
        quat_delta = max(abs(x-y) for x,y in zip(b['camera']['quaternion'],c['camera']['quaternion']))
        # Authored stationary cameras are exact. Narrative poses retain natural breathing.
        assert pos_delta < .025 and quat_delta < .003, (b['n'],pos_delta,quat_delta)
        pairs.append({'n':b['n'], 'name':b['name'], 'before':f"{before}/{b['image']}", 'after':f"{after}/{c['image']}",
                      'viewport':manifests[before]['viewport'], 'tier':b['tier'],'scale':b['scale'],
                      'cameraPositionDeltaM':math.dist(b['camera']['position'],c['camera']['position']),
                      'cameraMaxAxisDeltaM':pos_delta,'quaternionComponentDelta':quat_delta,
                      'cameraFovDeltaDegrees':fov_delta,'frustumEdgeScaleDriftPixels':edge_lens_drift,
                      'costBefore':{k:b[k] for k in ['calls','triangles','textures','geometries']},
                      'costAfter':{k:c[k] for k in ['calls','triangles','textures','geometries']}})
write('pairs.json', pairs)
reviews = read('frame-reviews.json')
assert {(r['folder'],r['n']) for r in reviews} == {(c['folder'],c['n']) for c in all_captures}, 'Missing manual frame review'
assert all(r['grade'] in ['A','B','C'] and 1 <= len(r['giveaways']) <= 3 for r in reviews)
table = ['# Frame inspection — V3.8 task 11', '',
         'A: plausibly photographic. B: close but detectable CG. C: clearly CG. Grades describe actual captured frames, not test outcomes.', '',
         '| Set | Frame | Grade | Remaining cues |', '| --- | --- | :---: | --- |']
by_frame={(c['folder'],c['n']):c for c in all_captures}
for r in reviews:
    c=by_frame[(r['folder'],r['n'])]
    table.append(f"| {r['folder']} | [{c['n']} {c['name']}]({r['folder']}/{c['image']}) | {r['grade']} | {'; '.join(r['giveaways'])} |")
(q / 'FRAME-REVIEW.md').write_text('\n'.join(table)+'\n')
write('cost-comparison.json', [{k:v for k,v in p.items() if k not in ['before','after']} for p in pairs])

payload={'pairs':pairs, 'gallery':[{'n':c['n'],'name':c['name'],'image':f"{c['folder']}/{c['image']}"} for c in all_captures if (c['folder']=='after' and 11 <= c['n'] <=34) or c['folder']=='no-post']}
template=(q/'viewer-template.html').read_text()
(q/'index.html').write_text(template.replace('__EVIDENCE__',json.dumps(payload,ensure_ascii=False).replace('</','<\\/')))
inventory={str(p.relative_to(q)):digest(p) for p in q.rglob('*') if p.is_file() and p.name not in ['integrity.json','package.log']}
write('integrity.json', {'sourceSha':results['sourceSha'],'buildId':results['buildId'],'matchingPairs':len(pairs),
                         'captures':len(all_captures),'stagesPassed':len(results['stages']),
                         'reflectionNonfinite':0,'sha256':inventory})
print(f"PASS: {len(all_captures)} reviewed frames, {len(pairs)} paired views, {len(results['stages'])} stages, finite reflections, source digests intact")

