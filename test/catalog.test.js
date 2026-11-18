import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,searchCatalog} from '../lib/catalog.js';
import {createSearchIndex,candidateSearch} from '../lib/search.js';
import {parseCsv,normalizeRecord,mergeCatalog} from '../lib/import-catalog.js';
import {questions,studentProfile,validateAnswers,compatibilityScore} from '../lib/recommendations.js';
import {allowRequest} from '../lib/rate-limit.js';

test('catalog search paginates without duplicates and filters categories',()=>{
 const first=searchCatalog(),second=searchCatalog({offset:first.nextOffset});
 assert.equal(first.clubs.length,24);assert.equal(new Set([...first.clubs,...second.clubs].map(c=>c.id)).size,48);
 assert.ok(searchCatalog({q:'aerospace'}).clubs.some(c=>c.id==='aiaa'));
 const category=first.categories[0];assert.ok(searchCatalog({category}).clubs.every(c=>c.category===category));
 assert.equal(searchCatalog({q:'zzzxxyyunknown'}).total,0);
});
test('search handles a 1,000+ record synthetic fixture with bounded diverse retrieval',()=>{
 const large=Array.from({length:20},(_,i)=>catalog.map(c=>({...c,id:`fixture-${i}-${c.id}`}))).flat();
 assert.ok(large.length>=1000);
 const index=createSearchIndex(large);
 const results=candidateSearch(index,{interests:['Arts & music','Cultural & international'],motivation:['Make friends / social']});
 assert.ok(results.length>=20&&results.length<=30);assert.equal(new Set(results.map(c=>c.id)).size,results.length);
 assert.ok(new Set(results.map(c=>c.category)).size>1);
});
test('imports parse quoted CSV, reject invalid provenance/duplicates and prevent stale updates',()=>{
 assert.deepEqual(parseCsv('name,description\r\n"A, B","Quoted ""text""\nline"'),[{name:'A, B',description:'Quoted "text"\nline'}]);
 assert.throws(()=>parseCsv('name,name\na,b'));assert.throws(()=>parseCsv('name\n"unclosed'));
 const raw={...catalog[0]};assert.equal(normalizeRecord(raw,questions).id,raw.id);
 for(const changes of [{source:'https://example.com/'},{officialUrl:'javascript:alert(1)'},{verifiedAt:'2099-01-01'},{interestTags:['Invented']},{campus:'Other'}])assert.throws(()=>normalizeRecord({...raw,...changes},questions));
 assert.throws(()=>mergeCatalog(catalog,[raw,raw],questions));
 assert.throws(()=>mergeCatalog(catalog,[{...raw,verifiedAt:'2000-01-01'}],questions));
 const merged=mergeCatalog(catalog,[{...raw,status:'inactive'}],questions);assert.equal(merged.report.updated,1);assert.equal(merged.report.inactive,1);
});
test('complete profile retains skipped questions and optional aerospace major',()=>{
 const answers=validateAnswers({answers:{motivation:['Learn a new skill'],interests:['Engineering & tech'],major:'Aerospace Engineering'}});
 const profile=studentProfile(answers);assert.equal(profile.responses.length,10);assert.equal(profile.major,'Aerospace Engineering');
 assert.equal(profile.responses.find(q=>q.id==='hours').value,null);
 assert.throws(()=>validateAnswers({answers:{...answers,major:'x'.repeat(81)}}));
});
test('estimated rubric caps unknown logistics and refuses invented practical fit',()=>{
 const answers={college:'Engineering',majorRelated:'Yes'};
 assert.equal(compatibilityScore({interests:4,goals:4,academic:4,community:4,practical:null,financial:null},catalog[0],answers),59);
 assert.throws(()=>compatibilityScore({interests:4,goals:4,academic:4,community:4,practical:4,financial:null},catalog[0],answers));
});
test('paid daily budget applies across IPs and resets on next UTC day',async()=>{
 const env={GROQ_API_KEY:'test',AI_DAILY_REQUEST_LIMIT:'2'};
 assert.equal(await allowRequest('budget-a',{env,now:864000000}),true);
 assert.equal(await allowRequest('budget-b',{env,now:864000000}),true);
 assert.equal(await allowRequest('budget-c',{env,now:864000000}),false);
 assert.equal(await allowRequest('budget-c',{env,now:950400000}),true);
});
