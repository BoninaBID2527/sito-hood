from pathlib import Path
import hashlib,json,re
root=Path('qa/v38/plaza02');source=json.loads((root/'source.json').read_text())
for f,h in source['implementationFiles'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
for row in source['unchanged']:assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()==row['baseline']==row['candidate'],row['file']
review=json.loads((root/'frame-review.json').read_text());assert len(review['frames'])==125
for r in review['frames']:assert (root/r['path']).is_file(),r['path']
assert json.loads((root/'viewer-validation.json').read_text())['passed']
assert 'CONCLUSION_REPLACE' not in (root/'README.md').read_text()
records=[]
for p in sorted(root.rglob('*')):
 if p.is_file() and p.name!='integrity.json':
  assert '__pycache__' not in p.parts
  records.append({'file':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(root/'integrity.json').write_text(json.dumps({'passed':True,'sourceHashesUnchanged':True,'reviewedImagesExist':125,'relativeMarkdownLinksValid':True,'files':records},indent=2)+'\n')
for f in root.glob('*.md'):
 for link in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  if not re.match(r'https?://|#',link):assert (f.parent/link).exists(),(f.name,link)
print('PASS source hashes, 125 reviewed images, viewer, Markdown links and',len(records),'file checksums')
