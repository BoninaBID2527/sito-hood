// Review artifacts live outside public/ and never enter the site's asset payload.
import sharp from 'sharp'
import {readdirSync,mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
const root='qa/v37/images';mkdirSync(root,{recursive:true})
for(const [version,dir] of [['v36','shots-final-v36'],['v37','shots-final-v37'],['nopost','shots-nopost-v37']]){
 if(!existsSync(dir))continue
 const out=join(root,version);mkdirSync(out,{recursive:true})
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.png'))){await sharp(join(dir,name)).webp({quality:94}).toFile(join(out,name.replace('.png','.webp')))}
 if(existsSync(join(dir,'manifest.json')))writeFileSync(join(root,version,'manifest.json'),readFileSync(join(dir,'manifest.json')))
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
