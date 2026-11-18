// Sends only synthetic preferences. No secrets needed by this HTTP client.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const base=process.argv.find(a=>a.startsWith('--url='))?.slice(6)||'http://127.0.0.1:3000';
const profiles={
 engineering:{motivation:['Build my resume / career','Learn a new skill'],interests:['Engineering & tech','Science & research'],college:'Engineering',major:'Aerospace Engineering',majorRelated:'Yes',hours:'2-5 hours',freeDays:['Tuesday'],size:'No preference',vibe:3,experience:'Some',budget:'Up to $25'},
 music:{motivation:['Explore a hobby','Make friends / social'],interests:['Arts & music'],college:'Arts & Architecture',majorRelated:"Doesn't matter",hours:'2-5 hours',freeDays:['Friday'],size:'No preference',vibe:1,experience:'None, beginner welcome',budget:'Free only'},
 service:{motivation:['Give back / community service','Connect with my culture or identity'],interests:['Service & THON','Cultural & international','Politics & advocacy'],college:'Liberal Arts',majorRelated:'No',hours:'5-10 hours',freeDays:['Saturday'],size:'No preference',vibe:3,experience:'Some',budget:'Up to $25'}
};
assert.equal((await fetch(base)).status,200);
assert.equal((await fetch(base+'/.env.local')).status,404);
const catalog=await (await fetch(base+'/api/clubs?limit=1')).json();
assert.equal(catalog.catalogTotal,108);assert.equal(catalog.recommendationEligibleTotal,104);
const send=async answers=>{const r=await fetch(base+'/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers}),signal:AbortSignal.timeout(32000)});assert.equal(r.status,200);return r.json();};
const fingerprints=[];let ai=0;
for(const [name,answers] of Object.entries(profiles)){
 const r=await send(answers);assert.ok(['ai','fallback'].includes(r.mode));if(r.mode==='ai')ai++;
 assert.ok(r.recommendations.length>0&&r.recommendations.length<=8);
 assert.ok(r.recommendations.every(x=>x.clubId===x.club.id&&x.club.recommendationEligible!==false&&x.explanation&&x.score<=90));
 fingerprints.push(r.recommendations.slice(0,3).map(x=>x.clubId).join(','));
 console.log(name,r.mode,r.recommendations.map(x=>`${x.clubId}:${x.score}`).join(', '));
 if(name==='engineering'){
  const concurrent=await Promise.all(Array.from({length:3},()=>send(answers)));
  assert.ok(concurrent.every(x=>x.mode==='fallback'&&/Non-AI/.test(x.message)));
  console.log('Three concurrent duplicate submissions returned labeled fallback; no additional AI admission.');
 }
 if(name!=='service')await delay(66000);
}
assert.equal(new Set(fingerprints).size,3);
console.log(`HTTP release smoke passed; ${ai}/3 profiles returned live AI. Other results, if any, were explicitly labeled fallback.`);
if(process.argv.includes('--require-ai'))assert.ok(ai>0,'No live AI response verified');
