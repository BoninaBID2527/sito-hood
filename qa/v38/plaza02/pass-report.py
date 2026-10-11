from pathlib import Path
import json,collections,statistics
root=Path('qa/v38/plaza02');rows=[]
for label in ['recheck-before','recheck-after']:
 data=json.loads((root/label/'surround-passes.json').read_text());assert data['afterAllTimingSamples']
 for a in data['audits']:
  totals=collections.defaultdict(lambda:collections.defaultdict(int));names=collections.defaultdict(set)
  for r in a['draws']:totals[r['pass']][r['frame']]+=r['instances'];names[r['pass']].add(r['name'])
  summary={p:{'observedFrames':len(values),'instanceTotalsPerObservedFrame':sorted(set(values.values())),'medianInstancesPerObservedFrame':statistics.median(values.values()),'drawnBatchNames':sorted(names[p])} for p,values in totals.items()}
  rows.append({'dataset':label,'view':a['name'],'camera':a['camera'],'passes':summary})
(root/'pass-comparison.json').write_text(json.dumps({'timingUnaffected':True,'method':'Render and shadow callbacks attached after the six cost samples. Totals sum actual instances in each runtime frame; secondary may include more than one reflected camera and is refreshed by the existing gate. These are draw submissions, not new geometry.','rows':rows},indent=2)+'\n')
print(json.dumps(rows,indent=2))
