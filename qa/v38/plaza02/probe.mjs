// Task 02: serial software-GL cost samples and complete plaza coverage.
// node probe.mjs <port> <outdir> <builddir> [balanced|mobile|high|ultra] [cost|visual|diagnostic]
import {chromium} from '../../../scripts/browser.mjs'
import {CHECKPOINTS,runCheckpoint} from '../../../scripts/qa37-lib.mjs'
import {reflectionHealth} from '../../../scripts/reflection-health.mjs'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
const [port,out,builddir,tier='balanced',mode='cost']=process.argv.slice(2)
if(!port||!out||!builddir)throw Error('port, output and build directory required')
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
const page=await(await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1})).newPage()
const errors=[],rows=[],log=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>m.type()==='error'&&errors.push(m.text()))
const until=(f,a)=>page.waitForFunction(f,a,{timeout:600000,polling:250})
const settle=()=>until(()=>{const r=window.__hd.rt;return Math.abs(r.smooth-r.progress)<.0008&&Math.abs(r.velocity)<.001&&(r.smooth<.375||r.smooth>.635||(Math.abs(r.orbit.err)<.02&&Math.abs(r.orbit.vel)<.06))})
const config={sourceCommit:process.env.SOURCE_SHA,buildId:readFileSync(`${builddir}/BUILD_ID`,'utf8').trim(),tier,viewport:[640,360],bootstrapViewport:[320,180],scale:.6,warmFrames:20,sampleFrames:24,mode,softwareGL:true,started:new Date().toISOString()}
const save=()=>writeFileSync(`${out}/results.json`,JSON.stringify({...config,rows,errors},null,2)+'\n')
const snapshot=()=>page.evaluate(()=>{const r=window.__hd.rt,g=window.__gl,c=window.__camera;return{camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov},tier:r.quality.tier,scale:r.scale,world:r.world,progress:r.smooth,calls:r.stats.calls,triangles:r.stats.tris,textures:g.info.memory.textures,geometries:g.info.memory.geometries,masonryWidth:window.__hd.A.brick.concrete.map.image.width}})
const sample=async(name,moving=false)=>{
 const data=await page.evaluate(async({warm,samples,moving})=>{
  const r=window.__hd.rt,g=window.__gl,frames=[];let seen=r.time,last=performance.now()
  for(let i=0;i<warm+samples;){
   await new Promise(requestAnimationFrame)
   if(r.time===seen)continue
   seen=r.time;const now=performance.now()
   if(i>=warm)frames.push({intervalMs:now-last,progress:r.smooth,calls:r.stats.calls,triangles:r.stats.tris,reflectionPasses:r.stats.refl,cpuMs:r.cpuMs})
   // Identical chronological input across candidates; real spring motion.
   if(moving&&i>=warm){const p=.41+.185*(i-warm+1)/samples;window.__hd.jump(p)}
   last=now;i++
  }
  const med=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]
  return{frames,medianMs:med(frames.map(f=>f.intervalMs)),medianCpuMs:med(frames.map(f=>f.cpuMs)),calls:med(frames.map(f=>f.calls)),triangles:med(frames.map(f=>f.triangles)),textures:g.info.memory.textures,geometries:g.info.memory.geometries,scale:r.scale,tier:r.quality.tier}
 },{warm:config.warmFrames,samples:config.sampleFrames,moving})
 if(moving&&data.frames.at(-1).progress-data.frames[0].progress<.01)throw Error('No measured track motion')
 const reflections=await reflectionHealth(page);if(reflections.some(r=>r.nonfinite))throw Error('Nonfinite reflections')
 rows.push({name,...data,reflections});save();console.log(name,JSON.stringify({medianMs:data.medianMs,calls:data.calls,triangles:data.triangles}))
}
try{
 console.log('START',mode,tier,new Date().toISOString());
 await page.goto(`http://127.0.0.1:${port}/?debug=1&quality=${tier}&scale=.6`,{timeout:120000});console.log('NAVIGATED')
 await page.waitForSelector('button:has-text("ENTER")',{timeout:600000})
 await page.getByRole('button',{name:'ENTER WITHOUT SOUND',exact:true}).click({force:true});console.log('ENTERED');await page.setViewportSize({width:320,height:180})
 const masonryWidth={mobile:1024,balanced:1280,high:1536,ultra:2048}[tier];
 await until(w=>window.__hd.A.brick.concrete.map.image.width===w,masonryWidth)
 await page.setViewportSize({width:640,height:360});
 await until(()=>window.__hd.rt.width===640&&window.__hd.rt.height===360);
 console.log('TEXTURES READY / MEASUREMENT VIEWPORT RESTORED');
 await page.addStyleTag({content:'.overlay,.cursor,nextjs-portal{display:none!important}'})
 const rear={n:90,name:'plaza-rear',plaza:{pos:[0,2.2,-111],look:[0,3.8,-142],fov:60}}
 if(mode==='front-targeted'){
  config.sampleFrames=72;
  config.cameraProtocol='Actual baseline front pose, held through existing debug camOverride at progress .42; full native quality and post effects';
  const pose=JSON.parse(readFileSync('qa/v38/plaza02/before-balanced/results.json','utf8')).rows.find(r=>r.n===10).camera;
  const [x,y,z,w]=pose.quaternion,forward=[-2*(x*z+w*y),-2*(y*z-w*x),-(1-2*(x*x+y*y))];
  await page.evaluate(()=>{window.__hd.jump(.42);window.__hd.rt.snapSpring=.42});await settle();
  await page.evaluate(({pose,forward})=>{window.__hd.rt.camOverride={pos:pose.position,look:pose.position.map((v,i)=>v+forward[i]),fov:pose.fov}},{pose,forward});
  await until(p=>Math.hypot(...window.__camera.position.toArray().map((v,i)=>v-p[i]))<.00001,pose.position);
  await sample('front-fixed-72-frames');
  config.actualCamera=await snapshot();
 }else if(mode==='cost'){
  const tests=[{n:0,name:'opening-control',p:0},{n:10,name:'plaza-front',p:.42},rear,{n:0,name:'tracks-idle',p:.41}]
  for(const cp of tests)await runCheckpoint(page,cp,out,{until,settle,log,onShot:()=>sample(cp.name)})
  await page.evaluate(()=>{window.__hd.rt.camOverride=null;window.__hd.jump(.41);window.__hd.rt.snapSpring=.41});await settle()
  await sample('tracks-moving',true)
  await runCheckpoint(page,tests[0],out,{until,settle,log,onShot:()=>sample('opening-control-repeat')})
  // Diagnose the actual surround draws only AFTER every timing sample.
  // Render and shadow callbacks distinguish primary, secondary and shadow cameras.
  await page.evaluate(()=>{
   window.__qaSurroundPasses=[];window.__qaSurroundHooks=[];
   window.__scene.traverse(o=>{
    if(!o.isInstancedMesh||!o.castShadow||o.geometry?.index?.count!==144||o.geometry.attributes.position.count!==96)return;
    const render=o.onBeforeRender,shadow=o.onBeforeShadow;
    o.onBeforeRender=function(renderer,scene,camera,...args){window.__qaSurroundPasses.push({frame:window.__hd.rt.time,pass:camera===window.__camera?'main':'secondary',cameraType:camera.type,name:this.name||'global-surrounds',instances:this.count});render.call(this,renderer,scene,camera,...args)};
    o.onBeforeShadow=function(renderer,object,camera,shadowCamera,...args){window.__qaSurroundPasses.push({frame:window.__hd.rt.time,pass:'shadow',cameraType:shadowCamera.type,name:this.name||'global-surrounds',instances:this.count});shadow.call(this,renderer,object,camera,shadowCamera,...args)};
    window.__qaSurroundHooks.push({o,render,shadow});
   });
  });
  config.postCensusPassAudit=true;
  const audits=[];
  for(const cp of [tests[1],rear])await runCheckpoint(page,cp,out,{until,settle,log,onShot:async()=>{
   await page.evaluate(()=>window.__qaSurroundPasses=[]);
   await until(()=>new Set(window.__qaSurroundPasses.map(x=>x.frame)).size>=8);
   audits.push({name:cp.name,camera:(await snapshot()).camera,draws:await page.evaluate(()=>window.__qaSurroundPasses)});
  }});
  writeFileSync(`${out}/surround-passes.json`,JSON.stringify({afterAllTimingSamples:true,audits},null,2)+'\n');
  await page.evaluate(()=>window.__qaSurroundHooks.forEach(({o,render,shadow})=>{o.onBeforeRender=render;o.onBeforeShadow=shadow}));

 }else if(mode==='diagnostic'){
  await runCheckpoint(page,rear,out,{until,settle,log,onShot:async()=>{
   await page.screenshot({path:`${out}/rear-before-diagnostic.png`,timeout:240000});console.log('REAR CAPTURED');
   const inventory=await page.evaluate(()=>{
    const objects=[],materials=new Map();
    window.__scene.traverse(o=>{if(!o.material?.userData?.background)return;const m=o.material,g=o.geometry;g.computeBoundingBox();objects.push({uuid:o.uuid,material:m.uuid,bump:!!m.bumpMap,triangles:(g.index?.count??g.attributes.position.count)/3,vertices:g.attributes.position.count,bounds:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}});materials.set(m.uuid,m)})
    window.__qaBackgroundMaterials=[...materials.values()].map(m=>({m,bump:m.bumpMap}))
    return{objects,materials:materials.size,generatedPrograms:window.__gl.info.programs.map(p=>({usedTimes:p.usedTimes,fragmentSource:window.__gl.getContext().getShaderSource(p.fragmentShader)}))}
   });writeFileSync(`${out}/inventory.json`,JSON.stringify(inventory,null,2))
   await page.evaluate(()=>{
    window.__qaDraws=[];
    window.__scene.traverse(o=>{if(!o.isMesh)return;const old=o.onBeforeRender;o.onBeforeRender=function(renderer,scene,camera,geometry,material,...rest){old.call(this,renderer,scene,camera,geometry,material,...rest);window.__qaDraws.push({pass:camera===window.__camera?'main':'reflection',background:!!material.userData?.background,triangles:(geometry.index?.count??geometry.attributes.position.count)/3})}})
   })
   await until(()=>window.__qaDraws.length>150)
   const draws=await page.evaluate(()=>window.__qaDraws);writeFileSync(`${out}/draw-passes.json`,JSON.stringify(draws,null,2))
   // Instrumentation is diagnostic only, never used in the production census.
   await sample('with-bump')
   await page.evaluate(()=>window.__qaBackgroundMaterials.forEach(({m})=>{m.bumpMap=null;m.needsUpdate=true}))
   await sample('without-background-bump-diagnostic')
   await page.evaluate(()=>window.__qaBackgroundMaterials.forEach(({m,bump})=>{m.bumpMap=bump;m.needsUpdate=true}))
  }})
 }else{
  const selection=[...CHECKPOINTS.filter(c=>c.n===1||(c.n>=10&&c.n<=34)),{n:91,name:'rear-shutter-close',plaza:{pos:[-5.6,2,-116.5],look:[-5.6,2,-118],fov:42}},{n:92,name:'window-surround-close',plaza:{pos:[-7,2.5,-112.5],look:[-8.2,6.2,-118],fov:28}}]
  if(!process.env.SELECT)selection.splice(0,selection.length,...selection.filter(c=>c.n!==92));
  if(!process.env.SELECT&&['high','ultra'].includes(tier))selection.splice(0,selection.length,...selection.filter(c=>c.n<28||c.n>34));
  if(process.env.SELECT)selection.splice(0,selection.length,...selection.filter(c=>process.env.SELECT.split(',').some(t=>{const[a,b]=t.split('-').map(Number);return b?c.n>=a&&c.n<=b:c.n===a})))
  for(const cp of selection)await runCheckpoint(page,cp,out,{until,settle,log,onShot:async()=>{
   const state=await snapshot();const reflections=await reflectionHealth(page);if(reflections.some(r=>r.nonfinite))throw Error('Nonfinite reflection')
   const file=`${String(cp.n).padStart(2,'0')}-${cp.name}.png`;await page.screenshot({path:`${out}/${file}`,timeout:240000})
   rows.push({n:cp.n,name:cp.name,file,inspectionCamera:cp.plaza??null,...state,reflections});save();console.log('shot',cp.n,cp.name)
  }})
 }
 const surroundAudit=await page.evaluate(()=>{const rows=[];window.__scene.traverse(o=>{if(!o.isInstancedMesh||!o.castShadow||o.geometry?.index?.count!==144||o.geometry.attributes.position.count!==96)return;rows.push({name:o.name,count:o.count,geometry:o.geometry.uuid,material:o.material.uuid,matrices:Array.from(o.instanceMatrix.array),positions:Array.from(o.geometry.attributes.position.array),normals:Array.from(o.geometry.attributes.normal.array),frustumCulled:o.frustumCulled,boundingSphere:o.boundingSphere?{center:o.boundingSphere.center.toArray(),radius:o.boundingSphere.radius}:null})});return rows});
 writeFileSync(`${out}/window-surrounds.json`,JSON.stringify(surroundAudit,null,2)+'\n');
 const shaderAudit=await page.evaluate(()=>window.__gl.info.programs.map(p=>window.__gl.getContext().getShaderSource(p.fragmentShader)).filter(s=>s.includes('vBackgroundPosition')).map(s=>({footprintFilter:s.includes('float backgroundRelief'),explicitGradient:s.includes('textureGrad(bumpMap'),bump:s.includes('#define USE_BUMPMAP'),finiteFallback:s.includes('any(isnan(outgoingLight))')})));
 writeFileSync(`${out}/shader-audit.json`,JSON.stringify(shaderAudit,null,2)+'\n');
 if(errors.length)throw Error(errors.join('\n'))
}finally{save();await page.context().close();await browser.close()}
