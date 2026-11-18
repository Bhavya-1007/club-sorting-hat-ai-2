import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,questions,retrieveCandidates,compatibilityScore,validateModelResult,fallbackRecommendations} from '../lib/recommendations.js';
import {preferenceWarnings} from '../lib/club-details.js';
import {mergeCatalog} from '../lib/import-catalog.js';

test('audit holds survive import and cannot enter retrieval, fallback or model output',()=>{
 const held=catalog.filter(c=>c.recommendationEligible===false);
 assert.deepEqual(held.map(c=>c.id).sort(),['enactus','happy-valley-vc','pennharmonics','urban-gaming']);
 const answers={interests:['Arts & music'],motivation:['Make friends / social']};
 assert.ok(retrieveCandidates(catalog,answers).every(c=>c.recommendationEligible!==false));
 assert.equal(fallbackRecommendations(held,answers).length,0);
 for(const club of held){
  const payload={recommendations:[{clubId:club.id,assessment:{interests:3,goals:3,academic:null,community:2,practical:null,financial:null},connections:[{answerId:'interests',factId:club.facts[0].id,angle:'exploration'}]}]};
  assert.equal(validateModelResult(payload,[{...club,recommendationEligible:true}],answers).length,1);
  assert.throws(()=>validateModelResult(payload,[club],answers));
  const incoming={...club};delete incoming.recommendationEligible;
  const merged=mergeCatalog(catalog,[incoming],questions);
  assert.equal(merged.clubs.find(c=>c.id===club.id).recommendationEligible,false);
 }
});

test('one interest or repeated fact cannot produce overconfident compatibility',()=>{
 const club={...catalog[0],verifiedDetails:{}};
 const assessment={interests:4,goals:4,academic:null,community:4,practical:null,financial:null};
 assert.equal(compatibilityScore(assessment,club,{},[{id:'a'},{id:'b'}],['interests']),55);
 assert.equal(compatibilityScore(assessment,club,{},[{id:'a'},{id:'a'}],['interests','motivation']),64);
 assert.equal(compatibilityScore(assessment,club,{},[{id:'a'},{id:'b'}],['interests','motivation']),72);
});

test('documented commitment, experience and cost conflicts affect scores; unknowns do not',()=>{
 const answers={hours:'Under 2 hours',experience:'None, beginner welcome',budget:'Free only'};
 const club={...catalog[0],verifiedDetails:{weeklyHours:{value:6},experience:{value:'required'},costs:{value:{semesterUsd:60,scope:'published semester dues'}}}};
 assert.equal(preferenceWarnings(club,answers).length,3);
 assert.deepEqual(preferenceWarnings({...club,verifiedDetails:{}},answers),[]);
 assert.equal(compatibilityScore({interests:4,goals:4,academic:null,community:4,practical:4,financial:4},club,answers,[{id:'a'},{id:'b'},{id:'c'}],['interests','motivation','budget']),52);
});

test('prototype names are not valid model explanation angles',()=>{
 const club=catalog[0];
 assert.throws(()=>validateModelResult({recommendations:[{clubId:club.id,connections:[{answerId:'interests',factId:club.facts[0].id,angle:'toString'}]}]},[club],{interests:['Engineering & tech']}));
});
