// Serve this QA directory on localhost:3003 before running.
import {chromium} from '../../../scripts/browser.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1000,height:800}});
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
try{
 await page.route('**/*', r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:3003/index.html');
 const ready=()=>page.waitForFunction(()=>['before','after'].every(id=>{const el=document.getElementById(id);return el.complete&&el.naturalWidth>0}));
 await ready();
 const n=await page.locator('#view option').count();if(n!==77)throw Error(`Expected 77 pairs, got ${n}`);
 await page.click('#next');await ready();if(await page.locator('#view').inputValue()!=='1')throw Error('Next failed');
 await page.click('#prev');await ready();if(await page.locator('#view').inputValue()!=='0')throw Error('Previous failed');
 const option=await page.locator('#view option').evaluateAll(os=>os.find(o=>o.textContent.includes('keyboard-front')).value);
 await page.selectOption('#view',option);await ready();
 await page.locator('#slider').fill('25');await page.locator('#slider').dispatchEvent('input');
 const clip=await page.locator('#after').evaluate(el=>el.style.clipPath);if(!clip.includes('25%'))throw Error('Slider failed');
 await page.click('summary');
 const gallery=await page.locator('#gallery img').count();if(gallery!==29)throw Error(`Gallery ${gallery}`);
 const sources=await page.locator('img').evaluateAll(es=>es.map(el=>el.src));
 for(const src of sources){const loaded=await page.evaluate(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=src}),src);if(!loaded)throw Error(`Missing image ${src}`)}
 if(errors.length)throw Error(errors.join('\n'));
 const result={passed:true,pairedViews:n,galleryImages:gallery,standalone:true,servedOnLoopback:true,externalNetworkBlocked:true,selectPreviousNext:true,slider:true,errors};
 writeFileSync(new URL('./viewer-validation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}finally{await ctx.close();await browser.close()}
