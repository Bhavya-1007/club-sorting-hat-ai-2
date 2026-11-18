import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {clubs}=JSON.parse(await readFile('clubs.json','utf8'));
const urls=[...new Set(clubs.flatMap(c=>[c.source,c.officialUrl,c.activityEvidence?.source,...Object.values(c.verifiedDetails||{}).filter(Boolean).flatMap(d=>[d.source,...(typeof d.value==='string'&&d.value.startsWith('https:')?[d.value]:[])])]).filter(Boolean))];
const results=[];await mkdir('test-results/source-audit',{recursive:true});let cursor=0;
async function worker(){while(cursor<urls.length){const index=cursor++,url=urls[index];let record={url};try{const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});const html=await r.text();const body=html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();record={url,status:r.status,finalUrl:r.url,title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],textFile:`test-results/source-audit/${index}.txt`,javascriptOnly:/application requires JavaScript/i.test(body),length:body.length};await writeFile(record.textFile,body);}catch(e){record.error=e.name;}results.push(record);}}
await Promise.all([worker(),worker(),worker()]);
await writeFile('data/public-link-audit.json',JSON.stringify({checkedAt:'2026-11-18',results},null,2)+'\n');
console.log(JSON.stringify({urls:urls.length,statuses:results.reduce((a,r)=>(a[r.status||r.error]=(a[r.status||r.error]||0)+1,a),{})}));
