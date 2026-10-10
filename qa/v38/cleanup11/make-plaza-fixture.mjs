// Execute the actual V3.7 side-wall installation block with geometry recorders.
// Node 24 native TypeScript stripping; no duplicated placements or guessed RNG.
import * as THREE from 'three'
import {readFileSync,writeFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync('components/scene/street/plazaArch.ts','utf8')
const snippet=source.slice(source.indexOf('  const WX = 12'),source.indexOf('  void rs'))
if(!snippet.startsWith('  const WX = 12')||!snippet.includes('louvred vents'))throw Error('Regenerate extractor for changed plaza architecture')
const doorLine=readFileSync('components/scene/street/layout.ts','utf8').split('\n').find(l=>l.startsWith('export const plazaServiceDoors ='))
const plazaServiceDoors=new Function(stripTypeScriptTypes(doorLine.replace('export ',''))+';return plazaServiceDoors')()
const records=[]
class Recorder {
  place(g,x,y,z,rx=0,ry=0,rz=0){
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1)));g.computeBoundingBox()
    const b=g.boundingBox,size=new THREE.Vector3(),center=new THREE.Vector3();b.getSize(size);b.getCenter(center)
    records.push({kind:'plaza hardware',x:center.x,y:center.y,z:center.z,w:size.x,h:size.y,d:size.z});g.dispose();return this
  }
  box(w,h,d,x,y,z,rx=0,ry=0,rz=0){return this.place(new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz)}
  cyl(rt,rb,h,x,y,z,seg=8,rx=0,ry=0,rz=0){return this.place(new THREE.CylinderGeometry(rt,rb,h,seg),x,y,z,rx,ry,rz)}
}
new Function('stone','steel','cap','rubber','glow','lamps','plazaServiceDoors',stripTypeScriptTypes(snippet))(...Array.from({length:5},()=>new Recorder()),[],plazaServiceDoors)
writeFileSync('qa/v38/cleanup11/plaza-hardware.json',JSON.stringify(records,null,2)+'\n')
console.log('Recorded',records.length,'actual plaza hardware bounds')
