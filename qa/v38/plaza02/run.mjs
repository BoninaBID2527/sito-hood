import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,createWriteStream,existsSync} from 'node:fs';
const root='/workspace/sito-hood',qa=root+'/qa/v38/plaza02';
const env={...process.env,BROWSER_WS_ENDPOINT:readFileSync('/workspace/scratch/plaza02-browser-ws','utf8').trim(),SOURCE_SHA:'b250daf48b2e4a22d9d29038c50e632b9e5db8c5'};
while(true){try{const x=JSON.parse(readFileSync(qa+'/baseline-diagnostic/results.json'));if(x.rows.length===2&&!x.errors.length)break}catch{}await new Promise(r=>setTimeout(r,3000));}
const stages=[];
const run=async(name,args,extra={})=>{
 const started=new Date().toISOString();console.log('START',name,started);
 const log=createWriteStream(qa+'/'+name+'.log');
 const code=await new Promise(resolve=>{const c=spawn(args[0],args.slice(1),{cwd:root,env:{...env,...extra},stdio:['ignore','pipe','pipe']});c.stdout.pipe(log,{end:false});c.stderr.pipe(log,{end:false});c.on('error',e=>{log.write(String(e));resolve(-1)});c.on('close',resolve)});log.end();
 stages.push({name,args,started,ended:new Date().toISOString(),exit:code});writeFileSync(qa+'/stages.json',JSON.stringify(stages,null,2));console.log('END',name,code);
 if(code!==0)throw Error(name+' failed');
};
const probe=(port,dir,build,tier,mode)=>[process.execPath,'qa/v38/plaza02/probe.mjs',port,'qa/v38/plaza02/'+dir,build,tier,mode];
await run('baseline-cost',probe('3001','baseline-cost','/workspace/hood-plaza02-before/.next','balanced','cost'));
await run('baseline-visual',probe('3001','before-balanced','/workspace/hood-plaza02-before/.next','balanced','visual'));
await run('baseline-high-close',probe('3001','before-high','.invalid','high','visual').map(a=>a==='.invalid'?'/workspace/hood-plaza02-before/.next':a),{SELECT:'91'});
while(!existsSync('/workspace/scratch/plaza02-candidate-ready'))await new Promise(r=>setTimeout(r,3000));
await run('build-final',['npm','run','build']);
await run('typecheck',['npm','run','typecheck']);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3000'],{cwd:root,env,stdio:['ignore','pipe','pipe']});const serverLog=createWriteStream(qa+'/server.log');server.stdout.pipe(serverLog);server.stderr.pipe(serverLog);
for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:3000/');if(r.ok)break}catch{}await new Promise(r=>setTimeout(r,1000));}
await run('candidate-cost',probe('3000','candidate-cost','.next','balanced','cost'));
for(const tier of ['balanced','mobile','high','ultra'])await run('candidate-'+tier,probe('3000','after-'+tier,'.next',tier,'visual'));
await run('tracks',[process.execPath,'scripts/tracks-check.mjs','http://127.0.0.1:3000/','balanced','640x360'],{EXTRA:'&scale=.6'});
console.log('ALL STAGES COMPLETE');
