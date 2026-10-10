// Real mouse clicks and touch taps at the visible clue mesh's actual world position.
// Does not call foundLetter or patch state. Inspection cameras expose the wall support;
// the existing eggs suite separately checks the moved letter on the authored journey.
import { chromium } from '../../../scripts/browser.mjs'
import { writeFileSync } from 'node:fs'
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']})
const results = [], errors = []
try {
  for(const touch of [false,true]) {
    const ctx = await browser.newContext({viewport:{width:800,height:450},hasTouch:touch,isMobile:touch})
    const page = await ctx.newPage()
    page.on('pageerror', e=>errors.push(e.message));page.on('console',m=>m.type()==='error'&&errors.push(m.text()))
    await page.goto('http://localhost:3000/?debug=1&quality=mobile&scale=0.4')
    await page.waitForSelector('button:has-text("ENTER")',{timeout:600000})
    await page.click('button:has-text("ENTER")',{force:true})
    await page.addStyleTag({content:'.overlay,.cursor{display:none!important}'})
    for(let i=0;i<7;i++){
      // Park the mouse away from the clue so camera movement cannot find it
      // through a lingering hover before the click/tap being verified.
      await page.mouse.move(1,1)
      const progress = [0.08,.15,.2,.27,.29,.32,.45][i]
      await page.evaluate(p=>{window.__hd.jump(p);window.__hd.rt.snapSpring=p},progress)
      await page.waitForFunction(()=>Math.abs(window.__hd.rt.smooth-window.__hd.rt.progress)<.001,null,{timeout:240000})
      const target = await page.evaluate(i=>{
        const mesh=window.__scene.getObjectByName(`hooddino-letter-${i}`)
        if(!mesh?.visible)throw Error(`Missing visible letter mesh ${i}`)
        const pos=mesh.getWorldPosition(new window.__camera.position.constructor())
        const side=Math.sign(pos.x)
        window.__hd.rt.camOverride={pos:[i===6?side*8:0,pos.y,pos.z+1.5],look:pos.toArray(),fov:52}
        return {position:pos.toArray(),before:window.__hd.store.getState().letters[i]}
      },i)
      if(target.before)throw Error(`Letter ${i} already found before input`)
      await page.waitForTimeout(1800)
      const screen=await page.evaluate(i=>{
        const mesh=window.__scene.getObjectByName(`hooddino-letter-${i}`),c=window.__camera
        c.updateMatrixWorld();const v=mesh.getWorldPosition(new c.position.constructor()).project(c)
        return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight,z:v.z}
      },i)
      if(screen.z>1||screen.x<10||screen.x>790||screen.y<10||screen.y>440)throw Error(`Letter ${i} outside inspection frame`)
      const image = `picking-${touch ? 'touch' : 'mouse'}-${i}.png`
      await page.screenshot({path:`qa/v38/cleanup11/${image}`,timeout:240000})
      if(await page.evaluate(i=>window.__hd.store.getState().letters[i],i))throw Error(`Letter ${i} found before the actual input`)
      if(touch)await page.touchscreen.tap(screen.x,screen.y)
      else await page.mouse.click(screen.x,screen.y)
      await page.waitForFunction(i=>window.__hd.store.getState().letters[i],i,{timeout:30000})
      const row={input:touch?'touch':'mouse',index:i,...target,screen,image,found:true}
      results.push(row);console.log(`PASS ${row.input} visible letter ${i}`)
      await page.evaluate(()=>window.__hd.rt.camOverride=null)
    }
    await ctx.close()
  }
} finally {
  writeFileSync('qa/v38/cleanup11/picking.json',JSON.stringify({method:'visible mesh world position; real mouse click/touch tap; no foundLetter action',results,errors},null,2))
  await browser.close()
}
if(errors.length||results.length!==14)throw Error('Picking failed')
console.log('14 passed, 0 failed; no console errors')
