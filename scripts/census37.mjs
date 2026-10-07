// Paired V3.6/V3.7 probes. Run serially with identical tier, viewport, scale,
// images and browser flags; software GL reports relative wall cost, never FPS.
import {chromium} from './browser.mjs'
import {writeFileSync} from 'node:fs'
import {runCheckpoint} from './qa37-lib.mjs'
const [port='3000',out='census37.json',tier='balanced',vp='640x360']=process.argv.slice(2)
const [width,height]=vp.split('x').map(Number)
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']})
const page=await(await browser.newContext({viewport:{width,height}})).newPage()
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>m.type()==='error'&&errors.push(m.text()))
const until=(fn,arg,timeout=600000)=>page.waitForFunction(fn,arg,{timeout,polling:300})
const settle=()=>until(()=>{const r=window.__hd.rt;return Math.abs(r.smooth-r.progress)<.0008&&Math.abs(r.velocity)<.001&&(r.world!=='alley'||r.smooth<.375||r.smooth>.635||(Math.abs(r.orbit.err)<.02&&Math.abs(r.orbit.vel)<.06))})
const rows=[],log=[]
const sample=async(name)=>{
  const data=await page.evaluate(async()=>{
    const cost=[],calls=[],tris=[];let last=performance.now()
    for(let i=0;i<14;i++) {await new Promise(requestAnimationFrame);const t=performance.now();if(i>=4){cost.push(t-last);calls.push(window.__hd.rt.stats.calls);tris.push(window.__hd.rt.stats.tris)}last=t}
    const med=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)]
    const r=window.__hd.rt,g=window.__gl
    return{medianMs:med(cost),samplesMs:cost,calls:med(calls),triangles:med(tris),textures:g.info.memory.textures,geometries:g.info.memory.geometries,scale:r.scale,tier:r.quality.tier,world:r.world,masonryWidth:window.__hd.A.brick.concrete.map.image.width,buffer:[g.domElement.width,g.domElement.height]}
  });rows.push({name,...data});writeFileSync(out,JSON.stringify({port,tier,vp,rows,errors},null,2));console.log(name,JSON.stringify(data))
}
try {
 await page.goto(`http://localhost:${port}/?debug=1&quality=${tier}&scale=0.6`)
 await page.waitForSelector('button:has-text("ENTER")',{timeout:600000});await page.click('button:has-text("ENTER")',{force:true})
 await until(()=>window.__hd.A.brick.concrete.map.image.width>=1280||window.__hd.rt.quality.level===0)
 const checkpoints=[{name:'opening-street',p:0},{name:'deep-street',p:.3},{name:'plaza-front',p:.42},
 {name:'plaza-rear',plaza:{pos:[0,2.2,-111],look:[0,3.8,-142],fov:60}},
 {name:'tracks-idle',p:.41},{name:'rooftop',p:.87},{name:'ROOM',room:'station',i:1},{name:'DUALISMO',dual:'wide'}]
 for(const cp of checkpoints)await runCheckpoint(page,{...cp,n:0,wait:300},'.',{until,settle,log,onShot:()=>sample(cp.name)})
 await page.evaluate(()=>window.__hd.act('exitDualism'));await until(()=>window.__hd.store.getState().mode==='alterco')
 await page.evaluate(()=>{window.__hd.jump(.41);window.__hd.rt.snapSpring=.41});await settle()
 await page.evaluate(()=>{window.__hd.jump(.595);window.__hd.rt.snapSpring=.595});await sample('tracks-moving')
 if(errors.length)throw new Error(errors.join('\n'))
}finally{await browser.close()}
