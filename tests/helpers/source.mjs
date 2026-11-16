import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const webRoot=process.env.MAJABEED_WEB_ROOT||path.join(projectRoot,'www');
export const webSource=name=>fs.readFileSync(path.join(webRoot,name),'utf8');
export const coreSource=()=>fs.existsSync(path.join(webRoot,'game-core.js'))?webSource('game-core.js'):webSource('index.html');
