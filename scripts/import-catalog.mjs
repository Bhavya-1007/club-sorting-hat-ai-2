import { readFile,writeFile,mkdir,copyFile,rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCsv,mergeCatalog } from '../lib/import-catalog.js';
const args=process.argv.slice(2);const get=name=>args[args.indexOf(name)+1];
if(!args.includes('--file')&&!args.includes('--url')){console.error('Use --file approved.csv|approved.json OR --url approved-feed-url. Dry run by default; --write applies the validated merge.');process.exit(1);}
try{
  let records=[];
  if(args.includes('--file')){const file=get('--file');const raw=await readFile(file,'utf8');const parsed=file.endsWith('.csv')?parseCsv(raw):JSON.parse(raw.replace(/^\uFEFF/,''));records=Array.isArray(parsed)?parsed:parsed.clubs;}
  else{
    let next=new URL(get('--url'));const origin=next.origin;const seen=new Set();let pages=0;
    if(next.protocol!=='https:'||next.username||next.password||next.searchParams.has('key'))throw new Error('Use HTTPS and environment-based authentication, not URL credentials');
    while(next){
      if(++pages>100||seen.has(next.href)||next.origin!==origin)throw new Error('Pagination loop, cross-origin next link or page limit');seen.add(next.href);
      const headers={Accept:'application/json'};
      if(process.env.CATALOG_API_TOKEN)headers[process.env.CATALOG_AUTH_HEADER||'Authorization']=process.env.CATALOG_AUTH_HEADER?process.env.CATALOG_API_TOKEN:`Bearer ${process.env.CATALOG_API_TOKEN}`;
      const response=await fetch(next,{headers,signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!response.ok)throw new Error(`Approved feed returned HTTP ${response.status}`);
      const raw=await response.text();if(Buffer.byteLength(raw)>5_000_000)throw new Error('Feed page too large');
      const page=JSON.parse(raw);if(!Array.isArray(page.clubs))throw new Error('Feed adapter must return {clubs, next}');records.push(...page.clubs);
      next=page.next?new URL(page.next,next):null;
    }
  }
  if(!Array.isArray(records)||records.length>20000)throw new Error('Expected at most 20,000 records');
  const path=resolve('clubs.json');const current=JSON.parse(await readFile(path,'utf8'));const {questions}=JSON.parse(await readFile('questions.json','utf8'));
  const {clubs,report}=mergeCatalog(current.clubs,records,questions);console.log(JSON.stringify({...report,write:args.includes('--write')}));
  if(args.includes('--write')){
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');await mkdir('.catalog-backups',{recursive:true});await copyFile(path,`.catalog-backups/clubs-${stamp}.json`);
    await writeFile(`${path}.tmp`,JSON.stringify({...current,schemaVersion:4,catalogVersion:stamp,clubs},null,2)+'\n');await rename(`${path}.tmp`,path);
    console.log('Catalog updated atomically; previous snapshot preserved. Restart the local server and rebuild before deployment.');
  }
}catch(error){console.error('Import rejected:',error.message.replace(/https?:\/\/\S+/g,'[URL]'));process.exitCode=1;}
