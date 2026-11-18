import {createHash} from 'node:crypto';
import {configurationIssues} from './config.js';
const recent=new Map();let nextSlot=0;
// Keys contain hashes, not quiz answers. Atomic admission works across serverless instances.
const LUA="if redis.call('EXISTS',KEYS[1])==1 then return 'duplicate' end if redis.call('EXISTS',KEYS[2])==1 then return 'busy' end redis.call('SET',KEYS[1],'1','EX',35) redis.call('SET',KEYS[2],'1','EX',ARGV[1]) return 'admitted'";
export async function admitAI(ip,answers,{env=process.env,fetchImpl=fetch,now=Date.now()}={}){
 if(configurationIssues(env).length)throw new Error('AI configuration unavailable');
 const fingerprint=createHash('sha256').update(ip+'\n'+JSON.stringify(Object.entries(answers).sort())).digest('hex');
 const seconds=Number(env.AI_MIN_INTERVAL_SECONDS)||65;
 if(env.UPSTASH_REDIS_REST_URL){
  const r=await fetchImpl(env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:`Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(2000),body:JSON.stringify(['EVAL',LUA,'2',`sorting-hat:duplicate:${fingerprint}`,'sorting-hat:provider-slot',String(seconds)])});
  if(!r.ok)throw new Error('AI admission unavailable');
  const data=await r.json();if(data.error||!['admitted','duplicate','busy'].includes(data.result))throw new Error('AI admission unavailable');
  return data.result;
 }
 for(const [key,expires] of recent)if(expires<=now)recent.delete(key);
 if(recent.has(fingerprint))return 'duplicate';
 if(now<nextSlot)return 'busy';
 recent.set(fingerprint,now+35000);nextSlot=now+seconds*1000;return 'admitted';
}
