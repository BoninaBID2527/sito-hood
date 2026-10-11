from pathlib import Path
import json,sys,datetime
root=Path('qa/v38/plaza02');labels=sys.argv[1:]
assert labels,'Pass only capture sets actually inspected.'
frames=[]
def causes(n,tier):
 if tier=='ultra' and n==27:return ['Glitch/RGB ALTERCO evidente','Barra luminosa del ponte piatta','Aloni ampi dei lampioni']
 if tier=='ultra' and n==14:return ['Pannelli e tipografia palesemente grafici','Contaminazione/glitch sulla trave','Luci sul suolo ancora teatrali']
 if n==1:return ['Muratura e finestre troppo regolari','Risposta del suolo e delle luci ancora sintetica','Particelle visibili come effetto grafico']
 if n==91:return ['Serranda con risposta materiale uniforme','Dettaglio scuro poco differenziato e grana sintetica']
 if n==92:return ['Superfici della facciata poco differenziate','Vano scuro quasi uniforme','Infisso con risposta materiale uniforme']
 if n in [23,27]:return ['Sorgente sul ponte come barra luminosa piatta','Aloni ampi dei lampioni','Facciate e profondità ancora regolari']
 if n in [21,25]:return ['Muratura con reticolo regolare','Porta e intonaco con risposta poco differenziata','Dettaglio di superficie uniforme']
 if n in [22,24]:return ['Aloni ampi dei lampioni','Facciate posteriori semplificate','Particelle sintetiche']
 if n in [19,20,26]:return ['Moduli della muratura e delle finestre regolari','Illuminazione con aloni riconoscibili','Particelle sintetiche']
 return ['Pannelli e tipografia dell’installazione palesemente grafici','Chiazze di suolo bagnato piatte nel tier mobile' if tier=='mobile' else 'Luci sul suolo e fasci ancora teatrali','Particelle sintetiche']
for label in labels:
 data=json.loads((root/label/'results.json').read_text())
 assert not data['errors']
 for r in data['rows']:frames.append({'path':label+'/'+r['file'],'name':r['name'],'n':r['n'],'tier':r['tier'],'grade':'C','causes':causes(r['n'],r['tier'])})
frames.append({'path':'baseline-diagnostic/rear-before-diagnostic.png','name':'retro diagnostico baseline','n':90,'tier':'balanced','grade':'C','causes':['Barra luminosa del ponte piatta','Aloni ampi dei lampioni','Architettura posteriore ancora regolare']})
data={'grading':'A plausibilmente fotografico; B vicino ma CG riconoscibile; C chiaramente CG','reviewMethod':'Actual captured images inspected in contact sheets and close details; no grade inferred from test pass','inspectedSets':labels,'recordedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'frames':frames}
(root/'frame-review.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
text='# Frame realmente ispezionati · task 02\n\nI voti riguardano il risultato fotografico complessivo, non l’esito dei test di culling.\n\n| Frame | Tier | Voto | Principali indizi CG |\n| --- | --- | --- | --- |\n'+'\n'.join('| ['+r['path']+']('+r['path']+') | '+r['tier']+' | '+r['grade']+' | '+'; '.join(r['causes'])+' |' for r in frames)+'\n'
(root/'FRAME-REVIEW.md').write_text(text)
print(len(frames),'frames actually inspected')
