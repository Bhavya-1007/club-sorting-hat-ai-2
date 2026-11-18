import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCatalog} from '../lib/catalog-audit.js';
import {catalog,questions} from '../lib/recommendations.js';
import {normalizeRecord} from '../lib/import-catalog.js';
test('catalog audit flags duplicates, historical evidence and directory-only links',()=>{
 const a={...catalog[0],name:'Example Club',sourcePublishedAt:'2017-03-27',verifiedAt:'2020-01-01',officialUrl:'https://discover.psu.edu/organizations'};
 const b={...a,id:'fixture-b',name:'The Example Club at University Park'};
 const audit=auditCatalog([a,b],new Date('2026-11-18'));
 assert.equal(audit.potentialDuplicates.length,1);assert.equal(audit.historicalSources.length,2);
 assert.equal(audit.reviewOverdue.length,2);assert.equal(audit.genericDiscoverLinks.length,2);
});
test('production catalog has no known duplicates, generic Discover links or unsupported active claims',()=>{
 const audit=auditCatalog(catalog);
 assert.equal(audit.total,108);assert.deepEqual(audit.potentialDuplicates,[]);assert.deepEqual(audit.genericDiscoverLinks,[]);
 assert.equal(audit.currentRecognitionUnconfirmed,108);
 for(const c of catalog){assert.equal(c.status,'listed');normalizeRecord(c,questions);}
 assert.ok(audit.historicalSources.some(c=>c.id==='pennharmonics'));
});
