import { mkdir, copyFile, readFile } from 'node:fs/promises';
const publicFiles=['index.html','styles.css','app.js','questions.json','clubs.json'];
await mkdir('dist',{recursive:true});
for (const file of publicFiles) { if(file.endsWith('.json')) JSON.parse(await readFile(file,'utf8')); await copyFile(file,`dist/${file}`); }
console.log('Built public assets in dist/; Vercel handles api/ separately.');
