// Format manually inspected frames; never infer a photographic grade from tests.
import {readFileSync,writeFileSync} from 'node:fs'
import {CHECKPOINTS} from './qa37-lib.mjs'
const review=JSON.parse(readFileSync('qa/v37/visual-review.json','utf8'))
const source=JSON.parse(readFileSync('qa/v37/source-checks.json','utf8'))
if(review.sourceCommit!==source.implementationCommit)throw new Error('Manual review belongs to an earlier product source; inspect the new captures first')
const collections=[['baselineReviewed',Array.from({length:61},(_,i)=>i+1)],['reviewed',Array.from({length:61},(_,i)=>i+1)],['noPostReviewed',[1,6,10,19,27,41,54,59]],['noFogReviewed',[1,27,35,41,59]]]
for(const [key,expected] of collections){
 const rows=review[key]??[],ids=rows.map(r=>r.n).sort((a,b)=>a-b)
 if(JSON.stringify(ids)!==JSON.stringify(expected))throw new Error(`${key}: incomplete manual review`)
 if(rows.some(r=>!['A','B','C'].includes(r.grade)||!r.remaining?.length||r.remaining.length>3))throw new Error(`${key}: missing grade or visual reasons`)
}
const counts=rows=>Object.fromEntries(['A','B','C'].map(g=>[g,rows.filter(r=>r.grade===g).length]))
const summary={sourceCommit:review.sourceCommit,baselineSourceCommit:review.baselineSourceCommit,normal:counts(review.reviewed),baseline:counts(review.baselineReviewed),noPost:counts(review.noPostReviewed),noFog:counts(review.noFogReviewed),manuallyReviewedFrames:135}
writeFileSync('qa/v37/photographic-summary.json',JSON.stringify(summary,null,2)+'\n')
const escape=s=>s.replaceAll('|','\\|').replaceAll('\n',' ')
let md='# Manually inspected photographic frames\n\nA: plausibly photographic. B: close but detectable CG. C: clearly CG.\n\nAll 135 reviews come from actual image inspection; passing browser tests does not imply photographic quality.\n\n| # | Checkpoint | V3.6 | Final | Remaining final CG cues |\n| ---: | --- | :---: | :---: | --- |\n'
for(const cp of CHECKPOINTS){
 const before=review.baselineReviewed.find(r=>r.n===cp.n),after=review.reviewed.find(r=>r.n===cp.n)
 const filename=`${String(cp.n).padStart(2,'0')}-${cp.name}.webp`
 md+=`| ${cp.n} | ${cp.name} | [${before.grade}](images/v36/${filename}) | [${after.grade}](images/v37/${filename}) | ${escape(after.remaining.map(r=>`${r.category}: ${r.reason}`).join('; '))} |\n`
}
for(const [key,title] of [['noPostReviewed','Post disabled'],['noFogReviewed','Post and global fog disabled']]){
 md+=`\n## ${title}\n\n| # | Grade | Remaining CG cues |\n| ---: | :---: | --- |\n`
 for(const row of review[key]){
  const cp=CHECKPOINTS.find(c=>c.n===row.n),version=key==='noPostReviewed'?'nopost':'nofog'
  const filename=`${String(row.n).padStart(2,'0')}-${cp.name}.webp`
  md+=`| [${row.n}](images/${version}/${filename}) | ${row.grade} | ${escape(row.remaining.map(r=>`${r.category}: ${r.reason}`).join('; '))} |\n`
 }
}
writeFileSync('qa/v37/FRAME-REVIEW.md',md)
const frames = CHECKPOINTS.map(cp => {
  const before = review.baselineReviewed.find(r => r.n === cp.n), after = review.reviewed.find(r => r.n === cp.n)
  const file = `${String(cp.n).padStart(2,'0')}-${cp.name}.webp`
  return { n: cp.n, name: cp.name, before: `images/v36/${file}`, after: `images/v37/${file}`, beforeGrade: before.grade, afterGrade: after.grade, remaining: after.remaining }
})
const frameData = JSON.stringify(frames).replaceAll('<', '\\u003c')
// Local review artifact only: no external libraries, tracking or deployed UI.
writeFileSync('qa/v37/compare.html', `<!doctype html>
<html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HOODDINO — confronto V3.6 / V3.7</title><link rel="icon" href="data:,">
<style>
*{box-sizing:border-box}body{margin:0;background:#111;color:#eee;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:clamp(22px,4vw,34px);margin:0 0 8px}p{margin:8px 0 18px;color:#bbb}a{color:#d9bf7c}button,select,input{font:inherit}button,select{background:#222;color:#eee;border:1px solid #666;border-radius:4px;padding:10px;min-height:44px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}select{flex:1;min-width:220px}.frame{position:relative;aspect-ratio:16/9;background:#000;overflow:hidden}.frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.frame .after{clip-path:inset(0 calc(100% - var(--split,50%)) 0 0)}.line{position:absolute;top:0;bottom:0;left:var(--split,50%);width:2px;background:#eee;pointer-events:none}.badge{position:absolute;top:12px;background:#111d;padding:4px 10px;border-radius:3px;font-size:14px}.badge.left{left:12px}.badge.right{right:12px}label{display:block;margin:16px 0 0}input[type=range]{width:100%;min-height:44px;accent-color:#d9bf7c}h2{font-size:20px;margin:12px 0 6px}ul{padding-left:24px}footer{margin-top:24px;color:#aaa;font-size:14px}
</style><main>
<h1>HOODDINO × ALTERCO — V3.6 / V3.7</h1>
<p>61 inquadrature prima/dopo, con UI nascosta. Valutazione finale A${summary.normal.A} · B${summary.normal.B} · C${summary.normal.C}. A = fotografico; B = vicino, CG rilevabile; C = chiaramente CG.</p>
<nav aria-label="Inquadrature"><button id="prev" aria-label="Inquadratura precedente">←</button><select id="frame" aria-label="Scegli inquadratura"></select><button id="next" aria-label="Inquadratura successiva">→</button></nav>
<div class="frame" id="view"><img id="before" alt=""><img class="after" id="after" alt=""><div class="line"></div><span class="badge left" id="afterTag"></span><span class="badge right" id="beforeTag"></span></div>
<label for="split">Trascina per confrontare: V3.7 a sinistra, V3.6 a destra.</label><input id="split" type="range" min="0" max="100" value="50">
<h2 id="title"></h2><ul id="cues"></ul>
<footer>960×540, livello alto, scala interna 0.75. I voti derivano dall'ispezione delle immagini e non dai test funzionali. <a href="REPORT.md">Rapporto</a> · <a href="FRAME-REVIEW.md">Tutte le valutazioni</a>. Le immagini restano file locali del dossier, fuori dal sito distribuito.</footer>
</main><script>
const frames=${frameData};
const $=id=>document.getElementById(id), selector=$('frame');
for(const f of frames){const option=document.createElement('option');option.value=f.n;option.textContent=String(f.n).padStart(2,'0')+' — '+f.name.replaceAll('-',' ');selector.append(option)}
function show(n){const f=frames.find(f=>f.n===n);selector.value=String(n);$('before').src=f.before;$('after').src=f.after;$('before').alt='V3.6 '+f.name;$('after').alt='V3.7 '+f.name;$('beforeTag').textContent='V3.6 · '+f.beforeGrade;$('afterTag').textContent='V3.7 · '+f.afterGrade;$('title').textContent=f.name.replaceAll('-',' ');$('cues').replaceChildren();for(const cue of f.remaining){const li=document.createElement('li');li.textContent=cue.category+': '+cue.reason;$('cues').append(li)}$('prev').disabled=n===1;$('next').disabled=n===61}
selector.addEventListener('change',()=>show(Number(selector.value)));
$('prev').addEventListener('click',()=>show(Number(selector.value)-1));$('next').addEventListener('click',()=>show(Number(selector.value)+1));
$('split').addEventListener('input',e=>$('view').style.setProperty('--split',e.target.value+'%'));
show(27);
</script></html>`)
console.log(JSON.stringify(summary))
