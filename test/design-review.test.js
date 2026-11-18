import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog,questions,validateAnswers,studentProfile,retrieveCandidates,fallbackRecommendations,compatibilityScore,validateModelResult} from '../lib/recommendations.js';
import {budgetWarning,preferenceWarnings,modelFacts} from '../lib/club-details.js';
import {normalizeRecord,mergeCatalog} from '../lib/import-catalog.js';
const answers={motivation:['Give back / community service'],interests:['THON'],budget:'Free only'};
test('ten questions retain original positions; THON and optional budgets validate',()=>{
 assert.equal(questions.length,10);assert.equal(questions[3].max,3);assert.ok(questions[3].options.includes('THON'));
 assert.equal(questions[9].id,'budget');assert.equal(questions[9].required,false);
 assert.deepEqual(questions.filter((q,i)=>i!==3&&i!==9).map(q=>q.id),['motivation','college','majorRelated','hours','freeDays','size','vibe','experience']);
 for(const budget of questions[9].options)assert.equal(validateAnswers({answers:{...answers,budget}}).budget,budget);
 assert.throws(()=>validateAnswers({answers:{...answers,budget:'Cheap'}}));
 assert.throws(()=>validateAnswers({answers:{...answers,contact:['Email']}}));
 assert.equal(studentProfile(answers).responses.find(q=>q.id==='budget').value,'Free only');
});
test('THON-only retrieval and fallback require actual THON evidence',()=>{
 const candidates=retrieveCandidates(catalog,answers);assert.equal(candidates.length,2);
 assert.ok(candidates.every(c=>c.verifiedDetails.thon.value===true));
 assert.ok(fallbackRecommendations(candidates,answers).every(r=>r.club.verifiedDetails.thon.value===true));
});
test('budgets distinguish unknown, zero, affordable and over-budget dues',()=>{
 const known=catalog.find(c=>c.id==='powerlifting');
 assert.match(budgetWarning(known,answers),/\$60.*\$0.*Spring/);
 assert.equal(budgetWarning(known,{budget:'$51–$100'}),null);
 assert.equal(budgetWarning(known,{budget:'No preference'}),null);
 assert.equal(budgetWarning(catalog[0],answers),null);
 const free=structuredClone(known);free.verifiedDetails.costs.value.semesterUsd=0;
 assert.equal(budgetWarning(free,answers),null);
 const assessment={interests:4,goals:4,academic:null,community:4,practical:null,financial:0};
 assert.ok(compatibilityScore(assessment,known,answers)<=55);
 assert.throws(()=>compatibilityScore(assessment,catalog[0],answers));
});
test('verified constraints warn without inferring missing requirements',()=>{
 const fixture=structuredClone(catalog[0]);fixture.verifiedDetails.atmosphere={value:'competitive'};fixture.verifiedDetails.experience={value:'required'};
 assert.equal(preferenceWarnings(fixture,{vibe:1,experience:'None, beginner welcome'}).length,2);
 assert.equal(preferenceWarnings(catalog[0],{vibe:1,experience:'None, beginner welcome'}).length,0);
});
test('all production detail fields have provenance and imports preserve them',()=>{
 for(const c of catalog)assert.deepEqual(normalizeRecord(c,questions).verifiedDetails,c.verifiedDetails);
 const known=catalog.find(c=>c.id==='powerlifting');const legacy={...known};delete legacy.verifiedDetails;
 assert.deepEqual(mergeCatalog([known],[legacy],questions).clubs[0].verifiedDetails,known.verifiedDetails);
 assert.throws(()=>normalizeRecord({...catalog[0],interestTags:['THON']},questions));
 assert.throws(()=>normalizeRecord({...known,verifiedDetails:{costs:{...known.verifiedDetails.costs,source:'https://unverified.example/'}}},questions));
});
test('model cannot claim a budget or schedule fit from an organization purpose',()=>{
 const club=catalog.find(c=>c.id==='powerlifting');const assessment={interests:3,goals:2,academic:null,community:null,practical:null,financial:0};
 const result={clubId:club.id,assessment,connections:[{answerId:'budget',factId:club.facts[0].id,angle:'exploration'}]};
 assert.throws(()=>validateModelResult({recommendations:[result]},[club],answers));
 result.connections[0].factId=modelFacts(club).find(f=>f.field==='costs').id;
 assert.equal(validateModelResult({recommendations:[result]},[club],answers)[0].warnings.length,1);
});
