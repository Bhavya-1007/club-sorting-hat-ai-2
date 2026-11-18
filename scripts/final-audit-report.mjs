import {readFile,writeFile} from 'node:fs/promises';
import {auditCatalog} from '../lib/catalog-audit.js';
const {clubs}=JSON.parse(await readFile('clubs.json','utf8'));
const links=JSON.parse(await readFile('data/public-link-audit.json','utf8'));
const byUrl=new Map(links.results.map(r=>[r.url,r]));
const report={date:links.checkedAt,...auditCatalog(clubs),recommendationEligible:clubs.filter(c=>c.recommendationEligible!==false).length,
 activityCounts:clubs.reduce((a,c)=>(a[c.activityStatus]=(a[c.activityStatus]||0)+1,a),{}),
 held:clubs.filter(c=>c.recommendationEligible===false).map(c=>({id:c.id,name:c.name,notes:c.auditNotes})),
 linkSummary:{total:links.results.length,http200:links.results.filter(r=>r.status===200).length,javascriptOnly:links.results.filter(r=>r.javascriptOnly).length,unresolved:links.results.filter(r=>r.status!==200)},
 records:clubs.map(c=>({id:c.id,name:c.name,officialDirectoryName:c.officialDirectoryName||null,profileVerifiedAt:c.profileVerifiedAt||null,campus:c.campus,source:c.source,officialUrl:c.officialUrl,verifiedAt:c.verifiedAt,sourcePublishedAt:c.sourcePublishedAt||null,sourceStatus:byUrl.get(c.source)?.status||'unresolved',linkRequiresJavascript:byUrl.get(c.officialUrl)?.javascriptOnly||false,activityStatus:c.activityStatus,activityEvidence:c.activityEvidence,recommendationEligible:c.recommendationEligible,auditNotes:c.auditNotes}))};
await writeFile('data/final-quality-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,records:undefined},null,2));
