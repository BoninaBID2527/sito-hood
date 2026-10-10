"""Record notes AFTER manual inspection of the specified image set/range.

This is transcription of the reviewer's observations, not an image grader.
Usage: python .../record-review.py <folder> [number,number|first-last]
"""
import json, sys
from pathlib import Path
q=Path(__file__).resolve().parent
folder=sys.argv[1]
selection=sys.argv[2] if len(sys.argv)>2 else ''
def selected(n):
    if not selection:return True
    for term in selection.split(','):
        bounds=list(map(int,term.split('-')))
        if n==bounds[0] or len(bounds)==2 and bounds[0]<=n<=bounds[1]:return True
    return False
notes={
1:['tiling: invecchiamento della facciata ripetuto','silhouette: scooter e piccoli arredi semplificati','post-processing: particelle e grana narrative'],
2:['tiling: chiazze di intonaco ripetute','reflection: finestre con interni luminosi semplificati','construction: ferramenta e bordi molto regolari'],
3:['tiling: intonaco e mattone con motivi ripetuti','reflection: finestre calde piatte','atmosphere: haze e particelle stilizzate'],
4:['construction: davanzale e lampada con profili semplici','reflection: profondità/riflessi del vetro insufficienti','tiling: chiazze di intonaco ripetute'],
5:['construction: pattumiera e porta con bordi semplici','tiling: danni/intonaco molto regolari','post-processing: particelle davanti alla camera'],
6:['wetness: riflesso del lampione largo e uniforme','roughness: variazione dell’asfalto ancora poco differenziata','construction: cassonetto e cartoni semplificati'],
7:['construction: chiusino e bordi stradali molto regolari','tiling: grana dell’asfalto ripetuta','reflection: riflesso del lampione morbido e largo'],
8:['tiling: muri lunghi con variazione procedurale riconoscibile','atmosphere: haze viola e particelle stilizzate','construction: scatole e arredi molto semplici'],
43:['construction: bordi di monitor/desk e controlli semplificati','reflection: vetro del display con risposta ambientale debole','roughness: finiture di legno/plastica uniformi'],
44:['reflection: vetro del monitor senza riflessi sottili della stanza','construction: bezel e presentazione del display semplici'],
45:['reflection: display del video privo di profondità/riflessi convincenti','construction: monitor e supporto semplificati'],
46:['construction: coni e cabinet del diffusore semplici','roughness: risposta di cabinet/plastiche uniforme','tiling: venatura del desk regolare'],
47:['tiling: pattern della schiuma molto regolare','roughness: tessuto con dettaglio poco differenziato','indirect light: trattamento vicino al soffitto poco integrato'],
48:['construction: gambe e bordi del desk regolari','tiling: pavimento/legno con venatura ripetuta','indirect light: illuminazione sotto il desk semplificata'],
49:['construction: cablaggi e supporti con profili regolari','roughness: risposta di plastica/legno uniforme','indirect light: dettaglio della zona inferiore poco leggibile'],
50:['roughness: parete, carta e telaio con risposta poco differenziata','construction: presentazione della bio ancora molto planare','indirect light: illuminazione ampia e semplificata'],
56:['construction: soglia e porta con profili semplici','tiling: venatura del pavimento regolare','indirect light: fill della parete ancora ampio'],
140:['roughness: faccia dell’insegna molto uniforme','tiling: facciata con chiazze regolari','atmosphere: particelle narrative'],
141:['roughness: faccia dell’insegna molto uniforme','reflection: finestre calde semplificate','atmosphere: particelle narrative'],
142:['tiling: intonaco e mattone con motivi regolari','construction: profili di indicazioni e arredi semplici','direct light: lampade/emissione ancora teatrali'],
143:['construction: tasti e controlli del controller semplificati','roughness: plastiche e desk uniformi','tiling: venatura del desk riconoscibile'],
144:['construction: keybed e manopole con bordi regolari','roughness: plastica del controller uniforme','indirect light: risposta sul desk semplificata'],
145:['roughness: pittura, parete e carta poco differenziate','indirect light: luce locale ampia e semplificata','construction: testo/print ancora planari'],
146:['roughness: parete e carta con risposta uniforme','construction: profilo del tubo e stampa semplici','indirect light: integrazione della parete limitata'],
147:['construction: bulkhead con bordi molto netti','roughness: muratura e pittura poco differenziate','post-processing: particelle/grana stilizzate'],
148:['construction: bulkhead con profili semplici','roughness: muro molto uniforme','post-processing: particelle/grana stilizzate'],
149:['silhouette: skyline con griglie regolari','wetness: copertura del tetto molto uniforme','direct light: luce blu teatrale'],
150:['roughness: parete e assorbitore poco differenziati','construction: supporto del microfono semplice','indirect light: fill laterale uniforme'],
151:['tiling: tessuto/trattamento con pattern regolare','construction: parete e stampe molto planari','indirect light: fill laterale semplificato'],
152:['tiling: schiuma con pattern molto regolare','roughness: muro e carta poco differenziati','construction: profili di parete/hardware semplici'],
153:['tiling: mattone/intonaco regolari','roughness: vernice e substrato poco differenziati','construction: elementi di servizio semplici'],
154:['tiling: intonaco e muratura regolari','roughness: vernice e muro poco differenziati','construction: ferramenta e cassonetto semplici'],
155:['tiling: mattone e chiazze di intonaco regolari','roughness: pittura/muratura uniforme','construction: cartoni e accessori semplici'],
156:['construction: insegna e griglia con profili semplici','tiling: mattone e intonaco regolari','roughness: response del muro uniforme'],
157:['construction: profili dell’insegna e ferramenta semplici','tiling: variazione della facciata ripetuta','roughness: materiali di muro e insegna poco differenziati'],
}
def cues(n):
    if n in notes:return notes[n]
    if 11<=n<=18 or 28<=n<=34:return ['construction: card e tipografia hanno una composizione CG esplicita','direct light: coni/pool dei fari molto grafici','roughness: materiali dell’installazione uniformi']
    if 19<=n<=27:return ['tiling: finestre e muratura molto regolari','direct light: finestre/lampade con fill semplificato','atmosphere: particelle e haze stilizzate']
    if 35<=n<=37:return ['silhouette: edifici con profili e griglie semplici','wetness: coating del tetto con gloss uniforme','direct light: integrazione blu/viola teatrale']
    if n in [41,42]:return ['construction: controller, monitor e cabinet semplificati','roughness: desk e plastiche uniformi','indirect light: bounce della workstation ampio e poco complesso']
    if 100<=n<=131:return ['tiling: corsi dei mattoni e intonaco ripetuti','roughness: vernice e substrato poco differenziati','indirect light: response di parete/servizi semplificata']
    raise ValueError(n)
file=q/'frame-reviews.json';reviews=json.loads(file.read_text()) if file.exists() else []
by={(r['folder'],r['n']):r for r in reviews}
for c in json.loads((q/folder/'manifest.json').read_text())['captures']:
    if selected(c['n']):
        by[(folder,c['n'])]={'folder':folder,'n':c['n'],'grade':'C','giveaways':cues(c['n']),
            'method':'Actual image inspection: contact sheets and critical full-size frames; conservative photographic grade.'}
file.write_text(json.dumps(sorted(by.values(),key=lambda r:(r['folder'],r['n'])),indent=2,ensure_ascii=False)+'\n')
print('Recorded manual notes:',folder,selection or 'all',len(by),'total')
