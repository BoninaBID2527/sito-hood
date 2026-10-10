import json,re,math,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3]
fixture=json.loads(Path(__file__).with_name('geometry-fixture.json').read_text())
for name,digest in fixture['sha256'].items():
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=digest:raise SystemExit('Regenerate geometry fixture: '+name)
data=json.loads(Path(__file__).with_name('layout.json').read_text())
aspects={i:float(w)/float(h) for i,w,h in re.findall(r"add\([SP], '([^']+)', (\d+), (\d+)", (root/'lib/graffitiSheet.ts').read_text())}
for i in range(1,8): aspects[f'tp_{i}']=2/3
for i in ['hand_kold','hand_nyx','hand_skrt','hand_echo','hand_jade','hand_raw','hand_vert','hand_moss','hand_zed']:aspects[i]=2
for i in ['hand_hd','hand_ink']:aspects[i]=260/170
aspects['hand_alt']=280/170
aspects['hand_oka']=300/170
for i in ['far','back','hd','sette','ear','water','other','roof']:aspects['note_'+i]=3.2
for i in ['serif','anton','mono','xerox']:aspects['fr_'+i]=288/220
for i in range(1,4):aspects['fl_'+str(i)]=320/448
block=[]
def add(side,z,y,w,h,kind):block.append(dict(side=side,z=z,y=y,w=w,h=h,kind=kind))
for d in data['wins']:add(d['side'],d['z'],d['y'],d['w']+.16,1.55*d['h']+.2,'window/reveal')
for kind,w,h in [('shutters',3.15,2.98),('doors',1.5,2.58)]:
 for group in data['level'][kind]:
  for d in group:add(d['side'],d['z'],h/2,w,h,kind)
fire=[(-1,-15),(-1,-33),(-1,-50),(1,0),(1,-18),(1,-37),(1,-52)]
for side,z in fire:add(side,z+side*1.05,2.8,.65,2.4,'ladder')
for s in data['segs']+[dict(side=side,z0=-76,z1=-118,hw=12,h=20) for side in [-1,1]]:
 side=s['side'];plaza=s['z0']==-76; pitch=3.4 if plaza else 3
 blockers=[(d['z']-r,d['z']+r) for kind,r in [('shutters',1.6),('doors',.9)] for group in data['level'][kind] for d in group if d['side']==side]
 blockers +=[(z-1.9,z+1.9) for ss,z in fire if ss==side]+[(k['z']-1.2,k['z']+1.2) for k in data['skip'] if k['side']==side]
 z=s['z0']-(3.7 if plaza else 2.9);j=0
 while z>s['z1']+1:
  if (plaza and j%3==0 or not plaza and j%2==0) and not any(a<z<b for a,b in blockers):add(side,z,2.1,.65,4.2,'pier')
  z-=pitch;j+=1
 if not plaza:add(side,s['z0']-.7,2.1,.28,4.2,'drainpipe')
 # reserves clearance around the existing two horizontal service routes
 if not plaza:add(side,(s['z0']+s['z1'])/2,2.95,s['z0']-s['z1']-3,.64,'gas-run')
 if not plaza:add(side,(s['z0']+s['z1'])/2-1,3.35,(s['z0']-s['z1']-3)*.8,.14,'conduit')
for fixture_name in ['hardware.json', 'plaza-hardware.json']:
 for b in json.loads(Path(__file__).with_name(fixture_name).read_text()):
  add(-1 if b['x']<0 else 1,b['z'],b['y'],b['d']+.12,b['h']+.12,b.get('kind','hardware'))
# installed studio entrance occupies the left wall in the final segment
add(-1,-67,1.35,2.5,2.7,'studio entrance')
add(-1,-69.4,1.5,2.35,1.25,'TRACKS sign')
add(1,-67.3,1.4,2.55,1.05,'ROOF sign')
add(-1,-9.8,2.0,1.22,.46,'OneWay sign')
block_by_side={side:[b for b in block if b['side']==side] for side in [-1,1]}
source=(root/'components/scene/street/StreetGraffiti.tsx').read_text();rows=re.findall(r"^  (\{ layer: .*?\}),?$",source,re.M)
items=[]
for idx,row in enumerate(rows):
 fields=dict(re.findall(r"(\w+): ('[^']*'|[LR]|-?[\d.]+)",row));item={k:(v.strip("'") if v.startswith("'") else -1 if v=='L' else 1 if v=='R' else float(v)) for k,v in fields.items()}; item['index']=idx
 if item['id'] not in aspects:continue
 item['aspect']=aspects[item['id']];items.append(item)
def bounds(it):
 a=abs(it.get('rot',0))+.015;w=it['w'];h=w/it['aspect'];return (w*math.cos(a)+h*math.sin(a))/2+.03,(h*math.cos(a)+w*math.sin(a))/2+.03
def collisions(it):
 dz,dy=bounds(it);z,y,side=it['z'],it['y'],it['side'];found=[]
 segs=[s for s in data['segs'] if s['side']==side and s['z1']<=z<=s['z0']] if z>=-76 else [dict(z0=-76,z1=-118)]
 if not segs or z+dz>segs[0]['z0']-.08 or z-dz<segs[0]['z1']+.08:found.append('segment step')
 if y-dy<.2:found.append('plinth/ground')
 if y+dy>4.2:found.append('first course')
 for b in block_by_side[side]:
  if b['side']==side and abs(b['z']-z)<b['w']/2+dz and abs(b['y']-y)<b['h']/2+dy:found.append(b['kind'])
 return sorted(set(found))
result=[dict(**it,conflicts=collisions(it)) for it in items]
Path(__file__).with_name('blockers.json').write_text(json.dumps(block,indent=2))
Path(__file__).with_name('placement-audit.json').write_text(json.dumps(result,indent=2))
for it in result:
 if it['conflicts']:print(it['index'],it['id'],it['side'],it['z'],it['y'],it['w'],','.join(it['conflicts']))
print('active',len(result),'conflicts',sum(bool(i['conflicts']) for i in result))

if any(i['conflicts'] for i in result):raise SystemExit('Unresolved footprint conflict')
signs=[]
for side,z,y,w,h,name in [(-1,-69.4,1.5,2.2,1.1,'TRACKS'),(1,-67.3,1.4,2.4,.9,'ROOF'),(-1,-9.8,2.0,1.1,.34,'OneWay')]:
 it=dict(side=side,z=z,y=y,w=w,aspect=w/h)
 found=[c for c in collisions(it) if c!=name+' sign']
 signs.append(dict(name=name,**it,conflicts=found))
Path(__file__).with_name('sign-support-audit.json').write_text(json.dumps(signs,indent=2)+'\n')
if any(s['conflicts'] for s in signs):raise SystemExit('Unresolved sign support conflict')
print('wall signs',len(signs),'conflicts',sum(bool(s['conflicts']) for s in signs))
