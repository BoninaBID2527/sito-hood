// Serial software-GL verification. Each stage records its exact invocation and
// exit code; failed stages remain failures and the final process exits nonzero.
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync,createWriteStream,readFileSync,existsSync} from 'node:fs'
const out=process.argv[2]||'qa/v37';mkdirSync(`${out}/logs`,{recursive:true})
const root=process.cwd(),base=process.env.BASELINE_DIR
const stages=[
 ['e2e',['scripts/e2e.mjs','shots-e2e-final','960x540'],{EXTRA:'&scale=0.45'}],
 ['ROOM-desktop',['scripts/room-check.mjs','balanced','960x540'],{EXTRA:'&scale=0.6'}],
 ['photographic-final',['scripts/qa37.mjs','shots-final-v37','960x540','high'],{EXTRA:'&scale=0.75'}],
 ['post-disabled',['scripts/qa37.mjs','shots-nopost-v37','960x540','high','1,6,10,19,27,41,54,59'],{EXTRA:'&scale=0.75',NOPOST:'1'}],
 ...(base?[
 ['photographic-baseline',['scripts/qa37.mjs',`${root}/shots-final-v36`,'960x540','high'],{PORT:'3001',EXTRA:'&scale=0.75'},base],
 ['performance-V36',['scripts/census37.mjs','3001',`${root}/${out}/performance-v36.json`],{EXTRA:''},base],
 ['performance-V37',['scripts/census37.mjs','3000',`${out}/performance-v37.json`],{EXTRA:''}],
 ]:[]),
 ['secrets',['scripts/secrets.mjs'],{EXTRA:'&scale=0.45'}],
 ['easter-eggs',['scripts/eggs.mjs'],{EXTRA:'&scale=0.45'}],
 ['tracks',['scripts/tracks-check.mjs','http://localhost:3000/','balanced'],{EXTRA:'&scale=0.45'}],
 ['reduced-motion',['scripts/reduced.mjs','shots-reduced-final.png'],{EXTRA:'&scale=0.45'}],
 ['ROOM-touch',['scripts/room-check.mjs','balanced','820x1180'],{EXTRA:'&scale=0.45',TOUCH:'1'}],
 ['ROOM-reduced',['scripts/room-check.mjs','balanced','960x540'],{EXTRA:'&scale=0.6',REDUCED:'1'}],
 ['ROOM-DOM-video',['scripts/room-check.mjs','balanced','960x540'],{EXTRA:'&scale=0.6&roomvideo=dom'}],
 ['static-smoke',['scripts/smoke.mjs','http://localhost:3002/sito-hood/?debug=1&quality=mobile','shots-static-smoke.png'],{EXTRA:'&scale=0.45'}],
 ['static-ROOM',['scripts/room-check.mjs','balanced','960x540'],{PORT:'3002',BASEPATH:'/sito-hood',EXTRA:'&scale=0.6'}],
]
// Inspect the render first so visual defects are corrected before spending time on regressions.
stages.sort((a, b) => Number(b[0] === 'photographic-final') - Number(a[0] === 'photographic-final'))
const results=process.env.RESUME === '1' && existsSync(`${out}/results.json`) ? JSON.parse(readFileSync(`${out}/results.json`, 'utf8')) : []
for(const [name,args,overrides,cwd=root] of stages){
 if (results.some(r => r.name === name && r.exitCode === 0)) { console.log(`SKIP ${name}: previously passed`); continue }
 const started=new Date().toISOString();console.log(`START ${name} ${started}`)
 const stream=createWriteStream(`${out}/logs/${name}.log`)
 const code=await new Promise(resolve=>{const p=spawn(process.execPath,args,{cwd,env:{...process.env,...overrides},stdio:['ignore','pipe','pipe']});p.stdout.pipe(stream,{end:false});p.stderr.pipe(stream,{end:false});p.on('error',e=>{stream.write(String(e));resolve(-1)});p.on('close',resolve)})
 stream.end();results.push({name,command:['node',...args],cwd,overrides,started,finished:new Date().toISOString(),exitCode:code})
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`END ${name}: ${code===0?'PASS':'FAIL'} (${code})`)
}
process.exitCode=results.some(r=>r.exitCode!==0)?1:0
