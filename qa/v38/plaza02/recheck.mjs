import {readFileSync,writeFileSync,createWriteStream} from 'node:fs';import {spawn} from 'node:child_process';
const root='/workspace/sito-hood',qa=root+'/qa/v38/plaza02';
while(true){try{const a=JSON.parse(readFileSync(qa+'/extra-stages.json'));if(a.length===2&&a.every(r=>r.exit===0))break;if(a.some(r=>r.exit!==0))throw Error('Extra stage failed')}catch(e){if(e.message==='Extra stage failed')throw e;}await new Promise(r=>setTimeout(r,3000));}
const results=[];const env={...process.env,BROWSER_WS_ENDPOINT:readFileSync('/workspace/scratch/plaza02-browser-ws','utf8').trim(),SOURCE_SHA:'b250daf48b2e4a22d9d29038c50e632b9e5db8c5'};
for(const [name,port,build] of [['recheck-before','3001','/workspace/hood-plaza02-before/.next'],['recheck-after','3000',root+'/.next']]){
 const started=new Date().toISOString(),log=createWriteStream(qa+'/'+name+'.log');const args=['qa/v38/plaza02/probe.mjs',port,'qa/v38/plaza02/'+name,build,'balanced','cost'];console.log('START',name,started);
 const code=await new Promise(resolve=>{const c=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});c.stdout.pipe(log,{end:false});c.stderr.pipe(log,{end:false});c.on('error',e=>{log.write(String(e));resolve(-1)});c.on('close',resolve)});log.end();results.push({name,args,started,ended:new Date().toISOString(),exit:code});writeFileSync(qa+'/recheck-stages.json',JSON.stringify(results,null,2));if(code!==0)throw Error(name+' failed');console.log('END',name,code);
}
