import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, questions, validateAnswers, studentProfile, retrieveCandidates, fallbackRecommendations, validateModelResult, recommend } from '../lib/recommendations.js';
import { allowRequest } from '../lib/rate-limit.js';
import handler from '../api/recommendations.js';
const engineering={motivation:['Build my resume / career','Learn a new skill'],interests:['Engineering & tech','Science & research'],college:'Engineering',majorRelated:'Yes',experience:'None, beginner welcome',hours:'2-5 hours',vibe:3};
const music={motivation:['Explore a hobby','Make friends / social'],interests:['Arts & music'],majorRelated:"Doesn't matter",vibe:1};
const service={motivation:['Give back / community service','Learn a new skill'],interests:['Service & THON','Politics & advocacy'],majorRelated:'No',college:'Engineering'};
test('catalog contains 20+ sourced University Park organizations, no invented logistics',()=>{
 assert.ok(catalog.length>=20); assert.equal(new Set(catalog.map(c=>c.id)).size,catalog.length);
 for(const c of catalog){ assert.equal(c.campus,'University Park'); assert.ok(!/placeholder/i.test(JSON.stringify(c))); assert.match(new URL(c.source).hostname,/(^|\.)psu\.edu$/); assert.match(new URL(c.officialUrl).hostname,/(^|\.)psu\.edu$/); assert.match(c.verifiedAt,/^2026-11-(17|18)$/); assert.ok(c.description&&c.facts.length); assert.equal(c.nextEvent,null); assert.equal(c.weeklyHours,null); assert.deepEqual(c.meetingDays,[]); for(const tag of c.interestTags)assert.ok(questions.find(q=>q.id==='interests').options.includes(tag)); }
});
test('all ten questions supported; answers strictly validated',()=>{
 assert.equal(questions.length,10); assert.deepEqual(validateAnswers({answers:engineering}),engineering);
 for(const answers of [{},{...engineering,interests:['Invented']},{...engineering,vibe:6},{...engineering,contact:['SMS']},{...engineering,extra:'injection'},{...engineering,motivation:['Learn a new skill','Learn a new skill']}]) assert.throws(()=>validateAnswers({answers}));
 assert.equal(studentProfile(engineering).responses.length,10);
});
test('three profiles produce meaningfully different grounded fallback rankings',async()=>{
 const results=[];
 for(const profile of [engineering,music,service]){const r=await recommend(profile,{apiKey:''});assert.equal(r.mode,'fallback');assert.match(r.message,/Non-AI/);assert.ok(r.recommendations.length>=3&&r.recommendations.length<=8);results.push(r.recommendations);}
 assert.ok(results[0].slice(0,3).every(r=>catalog.find(c=>c.id===r.clubId).interestTags.includes('Engineering & tech')));
 assert.ok(results[1].some(r=>r.clubId==='glee'));assert.ok(results[1].some(r=>r.clubId==='music-service'));
 assert.ok(results[2].some(r=>['food-recovery','poverty','upua'].includes(r.clubId)));
 assert.notDeepEqual(results[0].map(r=>r.clubId),results[1].map(r=>r.clubId));assert.notDeepEqual(results[1].map(r=>r.clubId),results[2].map(r=>r.clubId));
 console.log('Profile leaders:',results.map(r=>r.slice(0,3).map(x=>x.clubId).join(', ')).join(' | '));
});
test('retrieval is bounded and fallback permits fewer or zero results',()=>{
 assert.ok(retrieveCandidates(catalog,engineering,4).length===4);
 assert.equal(fallbackRecommendations([],engineering).length,0);
 assert.equal(fallbackRecommendations(catalog.filter(c=>c.id==='glee'),music).length,1);
});
test('real Groq Chat Completions request shape; model scores determine final order',async()=>{
 const chosen=['biotech','asabe'];let request;
 const response=await recommend(engineering,{apiKey:'test-only',fetchImpl:async(url,options)=>{
   assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');request=JSON.parse(options.body);
   return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({recommendations:chosen.map((id,i)=>({clubId:id,assessment:{interests:i?4:2,goals:3,academic:3,community:null,practical:null,financial:null},connections:[{answerId:'interests',angle:'academic',factId:`${id}:purpose`}]}))})}}]})};
 }});
 assert.equal(request.model,'openai/gpt-oss-20b');assert.equal(request.response_format.json_schema.strict,true);assert.equal(request.response_format.type,'json_schema');
 assert.equal(JSON.parse(request.messages[1].content).student.campus,'University Park');assert.equal(response.mode,'ai');assert.equal(response.recommendations[0].clubId,'asabe');
 assert.match(response.recommendations[0].reasons[0],/Engineering & tech/);
});
test('hallucinated IDs, facts, duplicate clubs, scores and skipped preferences rejected',()=>{
 const valid={clubId:'asabe',assessment:{interests:3,goals:3,academic:3,community:null,practical:null,financial:null},connections:[{answerId:'interests',answerValue:'Engineering & tech',angle:'academic',factId:'asabe:purpose'}]};
 for(const r of [{...valid,clubId:'fake'},{...valid,assessment:{...valid.assessment,interests:5}},{...valid,connections:[{answerId:'interests',factId:'glee:purpose'}]},{...valid,connections:[{answerId:'freeDays',factId:'asabe:purpose'}]}])assert.throws(()=>validateModelResult({recommendations:[r]},catalog,engineering));
 assert.throws(()=>validateModelResult({recommendations:[valid,valid]},catalog,engineering));
});
test('API errors, refusals, malformed and incomplete responses never masquerade as AI success',async()=>{
 for(const data of [{choices:[{finish_reason:'length'}]},{choices:[{finish_reason:'stop',message:{refusal:'declined'}}]},{choices:[{finish_reason:'stop',message:{content:'not json'}}]}])await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>data})}));
 await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async()=>({ok:false})}));
 await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async()=>({ok:false,status:429})}),error=>error.status===429 && /Groq usage limit/.test(error.message));
 await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async()=>{throw new DOMException('Timed out','TimeoutError');}}));
});
test('rate limiter enforces limits, expires, and fails closed for unprotected paid deployment',async()=>{
 for(let i=0;i<10;i++)assert.equal(await allowRequest('unit-test',{env:{},now:600000}),true);
 assert.equal(await allowRequest('unit-test',{env:{},now:600000}),false);
 assert.equal(await allowRequest('unit-test',{env:{},now:1200000}),true);
 await assert.rejects(allowRequest('unit-test',{env:{VERCEL:'1',GROQ_API_KEY:'test'}}));
 assert.equal(await allowRequest('redis-test',{env:{UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test'},fetchImpl:async()=>({ok:true,json:async()=>[{result:11},{result:1}]})}),false);
});
test('Groq schema-generation retry is bounded and shares one deadline',async()=>{
 let calls=0;const signals=[];
 await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async(url,options)=>{
   calls++;signals.push(options.signal);return {ok:false,status:400,json:async()=>({error:{code:'json_validate_failed'}})};
 }}));
 assert.equal(calls,2);assert.equal(signals[0],signals[1]);
 calls=0;
 await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async()=>{calls++;return {ok:false,status:401};}}));
 assert.equal(calls,1);
});
test('unsupported model evidence gets one bounded recovery without relaxing validation',async()=>{
 let calls=0;const signals=[];
 const result=await recommend(engineering,{apiKey:'test',fetchImpl:async(url,options)=>{
  calls++;signals.push(options.signal);
  const body=JSON.parse(options.body),input=JSON.parse(body.messages[1].content);
  assert.ok(input.candidates.every(c=>c.facts.every(f=>Array.isArray(f.allowedAnswerIds))));
  if(calls===2)assert.match(body.messages[0].content,/Previous output failed server validation/);
  return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({recommendations:[{clubId:'asabe',assessment:{interests:3,goals:3,academic:3,community:null,practical:null,financial:null},connections:[{answerId:'interests',factId:calls===1?'fake:purpose':'asabe:purpose',angle:'academic'}]}]})}}]})};
 }});
 assert.equal(result.mode,'ai');assert.equal(calls,2);assert.equal(signals[0],signals[1]);
 calls=0;
 await assert.rejects(recommend(engineering,{apiKey:'test',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"recommendations":[{"clubId":"fake"}]}'}}]})};}}));
 assert.equal(calls,2);
});
async function invoke(method,body,headers={}){let text;const res={setHeader(){},end(v){text=v;}};await handler({method,body,headers:{'content-type':'application/json',...headers},socket:{remoteAddress:'endpoint-test'}},res);return {status:res.statusCode,body:JSON.parse(text)};}
test('endpoint rejects wrong method, oversized bodies, invalid JSON and cross-site requests',async()=>{
 assert.equal((await invoke('GET',{})).status,405);
 assert.equal((await invoke('POST','{')).status,400);
 assert.equal((await invoke('POST','x'.repeat(9000))).status,413);
 assert.equal((await invoke('POST',{answers:engineering},{'content-type':'text/plain'})).status,415);
 assert.equal((await invoke('POST',{answers:engineering},{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await invoke('POST',{answers:{}})).status,400);
});
