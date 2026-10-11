// Compare real captured instance buffers, then check the maximum narrative
// displacement against the bounds consumed by every renderer camera.
import * as THREE from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
const root='qa/v38/plaza02/';
const before=JSON.parse(readFileSync(root+'before-balanced/window-surrounds.json'));
if(before.length!==1||before[0].frustumCulled!==false)throw Error('Baseline surround identification changed');
const instances=rows=>rows.flatMap(r=>Array.from({length:r.count},(_,i)=>JSON.stringify(r.matrices.slice(i*16,(i+1)*16)))).sort();
const expected=instances(before),results=[];
for(const tier of ['balanced','mobile','high','ultra']){
 const after=JSON.parse(readFileSync(root+'after-'+tier+'/window-surrounds.json'));
 if(JSON.stringify(instances(after))!==JSON.stringify(expected))throw Error(tier+': lost or changed window matrix');
 if(new Set(after.map(m=>m.geometry)).size!==1||new Set(after.map(m=>m.material)).size!==1)throw Error('Duplicated geometry/material');
 let maxExcess=-Infinity;
 for(const r of after){
  if(!r.frustumCulled||!r.boundingSphere)throw Error('Missing camera bounds');
  if(JSON.stringify(r.positions)!==JSON.stringify(before[0].positions)||JSON.stringify(r.normals)!==JSON.stringify(before[0].normals))throw Error('Template changed');
  const centre=new THREE.Vector3(...r.boundingSphere.center),m=new THREE.Matrix4();
  for(let instance=0;instance<r.count;instance++){
   m.fromArray(r.matrices,instance*16);
   for(let v=0;v<r.positions.length;v+=3)for(const displacement of [-.42,0,.42]){
    const p=new THREE.Vector3(r.positions[v]+r.normals[v]*displacement,r.positions[v+1]+r.normals[v+1]*displacement,r.positions[v+2]+r.normals[v+2]*displacement).applyMatrix4(m);
    maxExcess=Math.max(maxExcess,p.distanceTo(centre)-r.boundingSphere.radius);
   }
  }
 }
 if(maxExcess>1e-6)throw Error(tier+': displaced vertex outside camera bound');
 results.push({tier,instances:expected.length,batches:after.length,geometryAndMaterialShared:true,matricesAndTemplateUnchanged:true,maxDeformedVertexExcess:maxExcess});
}
writeFileSync(root+'batch-validation.json',JSON.stringify({passed:true,results},null,2)+'\n');
console.log('PASS exact instances, shared geometry/material and maximum-deformation camera bounds in all four tiers',JSON.stringify(results));
