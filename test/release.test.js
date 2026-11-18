import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationIssues} from '../lib/config.js';
import {admitAI} from '../lib/ai-admission.js';
import {reliableRecommendations} from '../lib/reliable-recommendations.js';
import {recommend} from '../lib/recommendations.js';
import handler from '../api/recommendations.js';
const answers={motivation:['Learn a new skill'],interests:['Engineering & tech']};
const valid={recommendations:[{clubId:'asabe',assessment:{interests:3,goals:3,academic:null,community:2,practical:null,financial:null},connections:[{answerId:'interests',factId:'asabe:purpose',angle:'learning'}]}]};
const success=()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(valid)}}]})});
test('transient failures have bounded backoff; auth/quota failures do not retry',async()=>{
 let calls=0;const delays=[],signals=[];
 const r=await recommend(answers,{apiKey:'test',sleep:async ms=>delays.push(ms),fetchImpl:async(u,o)=>{signals.push(o.signal);return ++calls===1?{ok:false,status:503}:success();}});
 assert.equal(r.mode,'ai');assert.equal(calls,2);assert.ok(delays[0]>=500&&delays[0]<600);assert.equal(signals[0],signals[1]);
 for(const status of [401,429]){calls=0;const fallback=await reliableRecommendations(answers,{apiKey:'test',fetchImpl:async()=>{calls++;return {ok:false,status};}});assert.equal(calls,1);assert.equal(fallback.mode,'fallback');assert.match(fallback.message,/Non-AI/);assert.ok(fallback.recommendations.length);assert.ok(fallback.recommendations.every(r=>r.club.recommendationEligible!==false&&r.clubId===r.club.id));}
});
test('slow provider returns grounded fallback within its deadline',async()=>{
 const started=Date.now();
 const r=await reliableRecommendations(answers,{apiKey:'test',timeoutMs:25,fetchImpl:async(u,{signal})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(success()),1000);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});})});
 assert.equal(r.mode,'fallback');assert.ok(Date.now()-started<700);
});
test('production environment validation rejects missing, partial and unsafe Redis configuration',()=>{
 assert.ok(configurationIssues({VERCEL:'1'}).some(s=>s.includes('GROQ_API_KEY')));
 for(const env of [{UPSTASH_REDIS_REST_URL:'https://x.upstash.io'},{UPSTASH_REDIS_REST_URL:'http://x.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test'},{AI_DAILY_REQUEST_LIMIT:'NaN'},{AI_MIN_INTERVAL_SECONDS:'0'}])assert.ok(configurationIssues(env).length);
 assert.deepEqual(configurationIssues({VERCEL:'1',GROQ_API_KEY:'test',UPSTASH_REDIS_REST_URL:'https://x.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test'}),[]);
});
test('simulated shared Redis atomically admits only one concurrent AI call and detects duplicates',async()=>{
 const keys=new Set();let calls=0;
 const options={env:{VERCEL:'1',GROQ_API_KEY:'test',UPSTASH_REDIS_REST_URL:'https://x.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test'},fetchImpl:async(u,o)=>{
  calls++;const command=JSON.parse(o.body);assert.equal(command[0],'EVAL');assert.match(command[1],/redis.call\('SET'/);assert.equal(command[2],'2');
  assert.ok(!o.body.includes('Engineering & tech'));
  const result=keys.has(command[3])?'duplicate':keys.has(command[4])?'busy':'admitted';
  if(result==='admitted'){keys.add(command[3]);keys.add(command[4]);}return {ok:true,json:async()=>({result})};
 }};
 const states=await Promise.all(Array.from({length:20},(_,i)=>admitAI('test-'+i,answers,options)));
 assert.equal(states.filter(s=>s==='admitted').length,1);assert.equal(calls,20);
 assert.equal(await admitAI('test-0',answers,options),'duplicate');
 await assert.rejects(admitAI('x',answers,{...options,fetchImpl:async()=>({ok:false})}));
});
test('missing production controls never call Groq; local forged IP headers cannot evade limits',async()=>{
 const saved={...process.env};
 async function invoke(headers={},ip='release-config'){let output;const res={setHeader(){},end(v){output=JSON.parse(v);}};await handler({method:'POST',body:{answers},headers:{'content-type':'application/json',...headers},socket:{remoteAddress:ip}},res);return {status:res.statusCode,...output};}
 try{
  process.env.VERCEL='1';process.env.GROQ_API_KEY='test';delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const r=await invoke();assert.equal(r.mode,'fallback');assert.match(r.message,/not configured/);
  delete process.env.VERCEL;delete process.env.GROQ_API_KEY;
  for(let i=0;i<10;i++)assert.equal((await invoke({'x-forwarded-for':String(i),'x-vercel-forwarded-for':String(i)},'release-spoof')).status,200);
  assert.equal((await invoke({'x-forwarded-for':'new-ip'},'release-spoof')).status,429);
 }finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
