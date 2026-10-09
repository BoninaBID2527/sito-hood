// V3.8 baseline read-only census. Each moving sample records real runtime motion.
// Software GL wall-clock intervals are not hardware GPU time or FPS.
import {chromium} from '../../../scripts/browser.mjs'
import {writeFileSync, readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {runCheckpoint} from '../../../scripts/qa37-lib.mjs'
import {reflectionHealth} from '../../../scripts/reflection-health.mjs'
const [port='3000',out='census37.json',tier='balanced',vp='640x360']=process.argv.slice(2)
const [width,height]=vp.split('x').map(Number)
const bounded=(key,fallback,max)=>{const n=Number(process.env[key]??fallback);if(!Number.isInteger(n)||n<1||n>max)throw new Error(`Invalid ${key}`);return n}
const settings={warmFrames:bounded('WARM_FRAMES',40,200),sampleFrames:bounded('SAMPLE_FRAMES',20,80),distinct:process.env.OBSERVE_DISTINCT_FRAMES==='1'}
const selection=process.env.SELECT?.split(',').filter(Boolean)

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']})
const page=await(await browser.newContext({viewport:{width,height}})).newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>m.type()==='error'&&errors.push(m.text()))
const until=(fn,arg,timeout=600000)=>page.waitForFunction(fn,arg,{timeout,polling:300})
const settle=()=>until(()=>{const r=window.__hd.rt;return Math.abs(r.smooth-r.progress)<.0008&&Math.abs(r.velocity)<.001&&(r.world!=='alley'||r.smooth<.375||r.smooth>.635||(Math.abs(r.orbit.err)<.02&&Math.abs(r.orbit.vel)<.06))})
const rows=[],log=[]
const buildId=readFileSync('.next/BUILD_ID','utf8').trim()
const sourceCommit=process.env.SOURCE_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const sample=async(name)=>{
  const data=await page.evaluate(async({settings,moving})=>{
    const cost=[],calls=[],tris=[],frameSamples=[];let last=performance.now()
    const progressStart=window.__hd.rt.smooth
    let observedTime=window.__hd.rt.time
    for(let i=0;i<settings.warmFrames+settings.sampleFrames;) {
      await new Promise(requestAnimationFrame)
      const t=performance.now(),time=window.__hd.rt.time
      if(settings.distinct&&time===observedTime)continue
      observedTime=time
      if(i>=settings.warmFrames){const r=window.__hd.rt;cost.push(t-last);calls.push(r.stats.calls);tris.push(r.stats.tris);frameSamples.push({intervalMs:t-last,progress:r.smooth,calls:r.stats.calls,triangles:r.stats.tris});if(moving)window.__hd.jump(.41+((i-settings.warmFrames+1)/settings.sampleFrames)*.185)}
      last=t;i++
    }
    const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]
    const r=window.__hd.rt,g=window.__gl
    return{frameSamples,medianMs:med(cost),samplesMs:cost,calls:med(calls),triangles:med(tris),textures:g.info.memory.textures,geometries:g.info.memory.geometries,scale:r.scale,tier:r.quality.tier,world:r.world,masonryWidth:window.__hd.A.brick.concrete.map.image.width,buffer:[g.domElement.width,g.domElement.height],progressStart,progressEnd:r.smooth}
  },{settings,moving:name==='tracks-moving'});
  if(name==='tracks-moving' && (Math.abs(data.frameSamples.at(-1).progress-data.frameSamples[0].progress)<.01 || data.frameSamples.filter((r,i,a)=>i>0&&Math.abs(r.progress-a[i-1].progress)>.0001).length<settings.sampleFrames/2))throw new Error('Measured samples did not observe sustained journey motion')
  const reflections=await reflectionHealth(page);
  if(process.env.REQUIRE_FINITE_REFLECTIONS==='1' && reflections.some(r=>r.nonfinite))throw new Error(`${name}: non-finite reflection radiance`);
  rows.push({name,...data,reflections});writeFileSync(out,JSON.stringify({sourceCommit,buildId,port,tier,vp,settings,selection,movingProtocol:`${settings.warmFrames} steady warmup frames; drive progress incrementally through ${settings.sampleFrames} measured runtime frames; retain chronological per-frame progress and cost`,rows,errors},null,2));console.log(name,JSON.stringify(data))
}
try {
 await page.goto(`http://localhost:${port}/?debug=1&quality=${tier}&scale=0.6`)
 await page.waitForSelector('button:has-text("ENTER")',{timeout:600000});await page.click('button:has-text("ENTER")',{force:true})
 await until(()=>window.__hd.A.brick.concrete.map.image.width>=1280||window.__hd.rt.quality.level===0)
 const checkpoints=[{name:'opening-street',p:0},{name:'deep-street',p:.3},{name:'plaza-front',p:.42},
 {name:'plaza-rear',plaza:{pos:[0,2.2,-111],look:[0,3.8,-142],fov:60}},
 {name:'tracks-idle',p:.41},{name:'rooftop',p:.87},{name:'ROOM',room:'station',i:1},{name:'DUALISMO',dual:'wide'}]
 for(const cp of checkpoints.filter(cp=>!selection||selection.includes(cp.name)))await runCheckpoint(page,{...cp,n:0,wait:300},'.',{until,settle,log,onShot:()=>sample(cp.name)})
 if(!selection||selection.includes('tracks-moving')) {
 await page.evaluate(()=>window.__hd.act('exitDualism'));await until(()=>window.__hd.store.getState().mode==='alterco'&&window.__hd.rt.world==='alley')
 await page.evaluate(()=>{window.__hd.jump(.41);window.__hd.rt.snapSpring=.41});await settle()
 await sample('tracks-moving')
 }
 if(errors.length)throw new Error(errors.join('\n'))
}finally{await browser.close()}
