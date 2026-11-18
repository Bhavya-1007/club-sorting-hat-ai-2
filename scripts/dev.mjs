import http from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from '../api/recommendations.js';
import clubsHandler from '../api/clubs.js';
const publicFiles = new Set(['index.html','app.js','styles.css','clubs.json','questions.json']);
const types={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json'};
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/clubs') return clubsHandler(req,res);
  if(pathname==='/api/recommendations') return handler(req,res);
  const file=pathname==='/'?'index.html':pathname.slice(1);
  if(!publicFiles.has(file) || !['GET','HEAD'].includes(req.method)) {res.writeHead(404);return res.end('Not found');}
  try {const body=await readFile(new URL(`../${file}`,import.meta.url));res.writeHead(200,{'Content-Type':`${types[file.split('.').pop()]}; charset=utf-8`,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);} catch {res.writeHead(500);res.end('Unable to load file');}
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
