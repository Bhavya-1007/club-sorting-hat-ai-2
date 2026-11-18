// Explicit opt-in live test: sends selected synthetic profiles to Groq and incurs API usage.
import assert from 'node:assert/strict';
import { recommend, validateAnswers } from '../lib/recommendations.js';
if (!process.env.GROQ_API_KEY?.trim()) {
  console.error('Set GROQ_API_KEY in .env.local before running the live AI smoke test.');
  process.exit(1);
}
const profiles = {
  thon: {motivation:['Give back / community service','Make friends / social'],college:'Engineering',majorRelated:'No',interests:['THON'],hours:'2-5 hours',freeDays:['Friday'],size:'No preference',vibe:2,experience:'None, beginner welcome',budget:'Free only'},
  engineering: {motivation:['Build my resume / career','Learn a new skill'],interests:['Engineering & tech','Science & research'],college:'Engineering',major:'Aerospace Engineering',majorRelated:'Yes',hours:'2-5 hours',freeDays:['Tuesday'],size:'No preference',vibe:3,experience:'Some',budget:'Up to $25'},
  music: {motivation:['Explore a hobby','Make friends / social'],interests:['Arts & music'],college:'Arts & Architecture',majorRelated:"Doesn't matter",hours:'2-5 hours',freeDays:['Friday'],size:'No preference',vibe:1,experience:'None, beginner welcome',budget:'Free only'},
  service: {motivation:['Give back / community service','Connect with my culture or identity'],interests:['Service & THON','Cultural & international','Politics & advocacy'],college:'Liberal Arts',majorRelated:'No',hours:'5-10 hours',freeDays:['Saturday'],size:'No preference',vibe:3,experience:'Some',budget:'Up to $25'},
};
const selectedName=process.argv.find(a=>a.startsWith('--profile='))?.slice(10);
if(selectedName&&!profiles[selectedName])throw new Error('Unknown synthetic profile');
const selected=selectedName?{[selectedName]:profiles[selectedName]}:profiles;
const fingerprints=[];
for (const [name,answers] of Object.entries(selected)) {
  const result = await recommend(validateAnswers({answers}));
  assert.equal(result.mode,'ai');
  assert.equal(result.provider,'groq');
  assert.ok(result.recommendations.length>0 && result.recommendations.length<=8);
  fingerprints.push(result.recommendations.slice(0,3).map(r=>r.clubId).join(','));
  console.log(name, result.recommendations.map(r=>`${r.clubId} (${r.score}): ${r.explanation}`).join('\n'));
  assert.ok(result.recommendations.every(r=>r.influencedBy.length && r.evidence.length));
  assert.ok(result.recommendations.every(r=>r.clubId===r.club.id && r.club.recommendationEligible!==false && r.score<=90));
  if(name!==Object.keys(selected).at(-1)){console.log('Spacing synthetic calls for Groq token limits (65 seconds).');await new Promise(resolve=>setTimeout(resolve,65000));}
}
assert.equal(new Set(fingerprints).size,Object.keys(selected).length,'Review model quality: these distinct profiles received identical top results.');
console.log('Live API smoke test passed. Review the rankings for relevance before publishing.');
