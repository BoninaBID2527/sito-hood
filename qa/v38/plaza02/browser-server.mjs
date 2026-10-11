import {chromium} from '/workspace/sito-hood/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
const server=await chromium.launchServer({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
writeFileSync('/workspace/scratch/plaza02-browser-ws',server.wsEndpoint());
console.log('QA browser server ready');
await new Promise(()=>{});
