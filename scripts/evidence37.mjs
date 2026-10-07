// Review artifacts live outside public/ and never enter the site's asset payload.
import sharp from 'sharp'
import {readdirSync,mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const root='qa/v37/images';mkdirSync(root,{recursive:true})
for(const [version,dir] of [['v36','shots-final-v36'],['v37','shots-final-v37'],['nopost','shots-nopost-v37'],['nofog','shots-base-v37']]){
 const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'))
 const expected=version==='nofog'?[1,27,35,41,59]:version==='nopost'?[1,6,10,19,27,41,54,59]:Array.from({length:61},(_,i)=>i+1)
 if(JSON.stringify(manifest.captures.map(c=>c.n))!==JSON.stringify(expected)||manifest.errors.length)throw new Error(`${version}: incomplete or failed capture sweep`)
 if(manifest.captures.some(c=>c.masonryWidth!==1536))throw new Error(`${version}: high-tier texture upgrade missing`)
 const out=join(root,version);mkdirSync(out,{recursive:true})
 for(const capture of manifest.captures){const name=`${String(capture.n).padStart(2,'0')}-${capture.name}.png`;await sharp(join(dir,name)).webp({quality:94}).toFile(join(out,name.replace('.png','.webp')))}
 writeFileSync(join(root,version,'manifest.json'),readFileSync(join(dir,'manifest.json')))
}
async function sheet(name,version,nums,cols=3){
 const dir=join(root,version);if(!existsSync(dir))return
 const files=readdirSync(dir);const w=400,h=225,label=28,rows=Math.ceil(nums.length/cols),parts=[]
 for(let i=0;i<nums.length;i++){
  const file=files.find(n=>n.startsWith(String(nums[i]).padStart(2,'0')+'-')&&n.endsWith('.webp'));if(!file)return
  const left=i%cols*w,top=Math.floor(i/cols)*(h+label)
  parts.push({input:await sharp(join(dir,file)).resize(w,h).toBuffer(),left,top})
  const title=file.replace('.webp','').replaceAll('&','&amp;')
  const svg=`<svg width="${w}" height="${label}"><rect width="100%" height="100%" fill="#181818"/><text x="8" y="19" fill="white" font-size="13" font-family="sans-serif">${version.toUpperCase()} ${title}</text></svg>`
  parts.push({input:Buffer.from(svg),left,top:top+h})
 }
 await sharp({create:{width:cols*w,height:rows*(h+label),channels:3,background:'#181818'}}).composite(parts).webp({quality:94}).toFile(join(root,name+'.webp'))
}
await sheet('plaza-in-360','v37',[11,12,13,14,15,16,17,18],2)
await sheet('plaza-out-360','v37',[19,20,21,22,23,24,25,26],2)
await sheet('tracks','v37',[28,29,30,31,32,33,34],2)
await sheet('room-sweep','v37',Array.from({length:20},(_,i)=>38+i),3)
for(const version of ['v36','v37'])await sheet('hero-'+version,version,[1,8,10,19,23,27,28,35,38,41,53,59],3)

await sheet('plaza-in-360-v36','v36',[11,12,13,14,15,16,17,18],2)
await sheet('plaza-out-360-v36','v36',[19,20,21,22,23,24,25,26],2)
await sheet('room-sweep-v36','v36',Array.from({length:20},(_,i)=>38+i),3)
await sheet('base-render-nopost','nopost',[1,6,10,19,27,41,54,59],2)
for(const version of ['v36','v37'])await sheet('room-hero-'+version,version,[40,41,43,45,50,51,52,54,55],3)

await sheet('base-render-no-fog','nofog',[1,27,35,41,59],2)
