import {randomUUID} from 'node:crypto';
import {configurationIssues} from '../lib/config.js';
const issues=configurationIssues(process.env,{production:true});
if(issues.length){console.error('Production configuration incomplete:\n'+issues.map(s=>'- '+s).join('\n'));process.exit(1);}
console.log('Production environment shape valid (no values displayed).');
if(process.argv.includes('--live')){
 const command=async body=>{const r=await fetch(process.env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),body:JSON.stringify(body)});if(!r.ok)throw new Error('Upstash request failed');const j=await r.json();if(j.error)throw new Error('Upstash command failed');return j.result;};
 const key='sorting-hat:release-check:'+randomUUID();
 try{
  if(await command(['PING'])!=='PONG')throw new Error('Redis PING failed');
  const results=await Promise.all([command(['SET',key,'1','NX','EX',15]),command(['SET',key,'1','NX','EX',15])]);
  if(results.filter(r=>r==='OK').length!==1||results.filter(r=>r===null).length!==1)throw new Error('Atomic admission check failed');
  console.log('Live Upstash authentication and atomic concurrent SET NX/expiry passed.');
 }finally{await command(['DEL',key]);}
}
