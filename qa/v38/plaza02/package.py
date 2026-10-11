from pathlib import Path
import json,math,hashlib,shutil,html
from PIL import Image,ImageDraw
root=Path('qa/v38/plaza02');load=lambda p:json.loads((root/p).read_text())
stages=load('stages.json');assert len(stages)==11 and all(x['exit']==0 for x in stages)
source=load('source.json')
for f,h in source['implementationFiles'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h
assert all(x['baseline']==x['candidate']==hashlib.sha256(Path(x['file']).read_bytes()).hexdigest() for x in source['unchanged'])
assert load('batch-validation.json')['passed']
assert len(load('front-stages.json'))==2 and all(r['exit']==0 for r in load('front-stages.json'))
assert len(load('recheck-stages.json'))==2 and all(r['exit']==0 for r in load('recheck-stages.json'))
assert len(load('extra-stages.json'))==2 and all(r['exit']==0 for r in load('extra-stages.json'))
expected={1,*range(10,35),91};sets={}
for label in ['before-balanced','before-high','after-balanced','after-mobile','after-high','after-ultra','before-window','after-window']:
 x=load(label+'/results.json');assert not x['errors']
 shaders=load(label+'/shader-audit.json');assert shaders and all(r['finiteFallback'] and not r['footprintFilter'] and not r['explicitGradient'] for r in shaders)
 assert {r['n'] for r in x['rows']}==({92} if label in ['before-window','after-window'] else {91} if label=='before-high' else expected-set(range(28,35)) if label in ['after-high','after-ultra'] else expected)
 w={'mobile':1024,'balanced':1280,'high':1536,'ultra':2048}[x['tier']]
 for r in x['rows']:
  assert r['tier']==x['tier'] and r['scale']==.6 and r['masonryWidth']==w and r['world']=='alley'
  assert all(h['nonfinite']==0 for h in r['reflections'])
  png=root/label/r['file'];webp=png.with_suffix('.webp')
  if png.exists():
   r['originalPNG_SHA256']=hashlib.sha256(png.read_bytes()).hexdigest()
   Image.open(png).save(webp,'WEBP',quality=94,method=6)
   raw=Path('/workspace/scratch/plaza02-original-png')/label;raw.mkdir(parents=True,exist_ok=True);shutil.move(png,raw/png.name)
   r['file']=webp.name
  assert (root/label/r['file']).exists()
  r['sha256']=hashlib.sha256((root/label/r['file']).read_bytes()).hexdigest()
 (root/label/'results.json').write_text(json.dumps(x,indent=2)+'\n');sets[label]=x['rows']
assert not load('baseline-cost/results.json')['errors'] and not load('candidate-cost/results.json')['errors']
comparisons=[]
for old in load('baseline-cost/results.json')['rows']:
 new=next(r for r in load('candidate-cost/results.json')['rows'] if r['name']==old['name'])
 assert len(old['frames'])==len(new['frames'])==24
 assert all(math.isfinite(f['intervalMs']) and f['intervalMs']>0 for r in [old,new] for f in r['frames'])
 assert all(h['nonfinite']==0 for r in [old,new] for h in r['reflections'])
 comparisons.append({'name':old['name'],'baselineMedianMs':old['medianMs'],'candidateMedianMs':new['medianMs'],'changePercent':100*(new['medianMs']/old['medianMs']-1),'calls':[old['calls'],new['calls']],'triangles':[old['triangles'],new['triangles']],'textures':[old['textures'],new['textures']],'geometries':[old['geometries'],new['geometries']],'baselineCpuMs':old['medianCpuMs'],'candidateCpuMs':new['medianCpuMs']})
(root/'performance-comparison.json').write_text(json.dumps(comparisons,indent=2)+'\n')
recheck=[]
for old in load('recheck-before/results.json')['rows']:
 new=next(r for r in load('recheck-after/results.json')['rows'] if r['name']==old['name'])
 assert len(old['frames'])==len(new['frames'])==24
 assert all(math.isfinite(f['intervalMs']) and f['intervalMs']>0 for r in [old,new] for f in r['frames'])
 assert not load('recheck-before/results.json')['errors'] and not load('recheck-after/results.json')['errors']
 recheck.append({'name':old['name'],'baselineMedianMs':old['medianMs'],'candidateMedianMs':new['medianMs'],'changePercent':100*(new['medianMs']/old['medianMs']-1),'calls':[old['calls'],new['calls']],'triangles':[old['triangles'],new['triangles']],'textures':[old['textures'],new['textures']],'geometries':[old['geometries'],new['geometries']]})
(root/'performance-recheck.json').write_text(json.dumps(recheck,indent=2)+'\n')
for label in ['recheck-before','recheck-after']:
 passAudit=load(label+'/surround-passes.json');assert passAudit['afterAllTimingSamples']
 assert {a['name'] for a in passAudit['audits']}=={'plaza-front','plaza-rear'}
 for a in passAudit['audits']:
  assert len({r['frame'] for r in a['draws']})>=8 and any(r['pass']=='main' for r in a['draws'])
  assert all(r['instances']>0 for r in a['draws'])
frontRows=[]
for label in ['front-before','front-after']:
 data=load(label+'/results.json');assert not data['errors'] and data['sampleFrames']==72 and len(data['rows'])==1
 row=data['rows'][0];assert len(row['frames'])==72 and row['scale']==.6 and row['tier']=='balanced'
 assert all(r['nonfinite']==0 for r in row['reflections'])
 frontRows.append({'dataset':label,**{k:row[k] for k in ['medianMs','medianCpuMs','calls','triangles','textures','geometries']},'camera':data['actualCamera']['camera']})
assert math.dist(frontRows[0]['camera']['position'],frontRows[1]['camera']['position'])<.00001
front={'rows':frontRows,'changePercent':100*(frontRows[1]['medianMs']/frontRows[0]['medianMs']-1),'cameraHeld':True,'sampleFrames':72,'hardwareFPS':False}
(root/'front-comparison.json').write_text(json.dumps(front,indent=2)+'\n')
pairs=[]
for label in ['balanced','high','window']:
 for old in sets['before-'+label]:
  new=next(r for r in sets['after-'+label] if r['n']==old['n'])
  distance=math.dist(old['camera']['position'],new['camera']['position'])
  dot=min(1,abs(sum(a*b for a,b in zip(old['camera']['quaternion'],new['camera']['quaternion']))));rotation=math.degrees(2*math.acos(dot))
  lens=320*abs(math.tan(math.radians(old['camera']['fov']/2))/math.tan(math.radians(new['camera']['fov']/2))-1)
  assert rotation<.1,(old['n'],rotation)
  assert distance<.04,(old['n'],distance)
  assert lens<.1,(old['n'],lens)
  pairs.append({'n':old['n'],'name':old['name'],'tier':old['tier'],'before':'before-'+label+'/'+old['file'],'after':'after-'+label+'/'+new['file'],'cameraDistanceMetres':distance,'cameraRotationDegrees':rotation,'lensEdgeDriftPixels':lens})
(root/'pairs.json').write_text(json.dumps(pairs,indent=2)+'\n')
assert len(pairs)==29
# Generate small sheets for actual manual review; do not infer a photographic grade.
frames=[(label,r) for label,rows in sets.items() for r in rows]
for start in range(0,len(frames),24):
 block=frames[start:start+24];sheet=Image.new('RGB',(1280,196*math.ceil(len(block)/4)),(20,20,20));draw=ImageDraw.Draw(sheet)
 for i,(label,r) in enumerate(block):
  x=i%4*320;y=i//4*196;im=Image.open(root/label/r['file']);im.thumbnail((320,180));sheet.paste(im,(x,y));draw.text((x+3,y+181),f'{label} / {r["n"]} {r["name"][:18]}',fill='white')
 sheet.save('/workspace/scratch/plaza02-review-'+str(start//24+1)+'.jpg',quality=94)
print('PASS',len(frames),'capture records;',len(pairs),'pairs; source and cost samples checked')
