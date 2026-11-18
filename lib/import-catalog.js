export function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw new Error('Invalid CSV quote');}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  row.push(cell);if(row.some(Boolean))rows.push(row);
  const headers=rows.shift()||[];
  if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV column');
  return rows.map(r=>{if(r.length!==headers.length)throw new Error('CSV column count mismatch');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
const text=(v,label,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Invalid ${label}`);return v.trim();};
export function officialUrl(v){const u=new URL(text(v,'source URL'));if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='psu.edu'||u.hostname.endsWith('.psu.edu')))throw new Error('Use an HTTPS Penn State source/profile URL');return u.href;}
const array=v=>Array.isArray(v)?v:typeof v==='string'?v.split('|').map(x=>x.trim()).filter(Boolean):[];
export function normalizeRecord(raw,questions){
  const id=text(raw.id,'stable id',120);if(!/^[a-z0-9][a-z0-9-]*$/.test(id))throw new Error('Invalid stable id');
  if(raw.campus!=='University Park')throw new Error(`${id}: campus must be University Park`);
  const source=officialUrl(raw.source),url=officialUrl(raw.officialUrl),verifiedAt=text(raw.verifiedAt,'verification date',10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)||!Number.isFinite(Date.parse(verifiedAt))||new Date(verifiedAt).toISOString().slice(0,10)!==verifiedAt||verifiedAt>new Date().toISOString().slice(0,10))throw new Error(`${id}: invalid verification date`);
  const description=text(raw.description,'description',1600);
  const tags=(field,qid)=>{const values=array(raw[field]);if(values.length>20||values.some(v=>!questions.find(q=>q.id===qid).options.includes(v)))throw new Error(`${id}: invalid ${field}`);return [...new Set(values)];};
  const interestTags=tags('interestTags','interests');if(!interestTags.length)throw new Error(`${id}: interests required`);
  const record={id,name:text(raw.name,'name',200),campus:'University Park',category:text(raw.category,'category',80),interestTags,motivationTags:tags('motivationTags','motivation'),relatedColleges:tags('relatedColleges','college'),description,officialUrl:url,source,verifiedAt,
    status:!raw.status||raw.status==='active'?'listed':raw.status,recognitionStatus:'not_confirmed',sourcePublishedAt:raw.sourcePublishedAt||null,verificationStatus:'Official source reviewed; current recruitment not independently confirmed',tagProvenance:'Editorial mappings, not official eligibility claims',
    facts:[{id:`${id}:purpose`,text:description,source}],keywords:array(raw.keywords).map(k=>text(k,'keyword',60)).slice(0,30),
    weeklyHours:null,meetingDays:[],meetingTime:null,size:null,vibe:null,beginnerFriendly:null,nextEvent:null,instagramUrl:null,groupMeAvailable:null};
  if(!['listed','inactive'].includes(record.status))throw new Error(`${id}: invalid status`);
  // Optional facts need their own source. Logistics are not inferred by this importer.
  if(raw.facts!==undefined){
    if(!Array.isArray(raw.facts)||!raw.facts.length||raw.facts.length>12)throw new Error(`${id}: invalid facts`);
    record.facts=raw.facts.map(f=>({id:text(f.id,'fact id',150),text:text(f.text,'fact text',1600),source:officialUrl(f.source)}));
    if(record.facts.some(f=>!f.id.startsWith(`${id}:`))||new Set(record.facts.map(f=>f.id)).size!==record.facts.length)throw new Error(`${id}: invalid fact IDs`);
  }
  if(record.sourcePublishedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(record.sourcePublishedAt)||!Number.isFinite(Date.parse(record.sourcePublishedAt))||new Date(record.sourcePublishedAt).toISOString().slice(0,10)!==record.sourcePublishedAt||record.sourcePublishedAt>verifiedAt))throw new Error('Invalid publication date');
  record.verifiedDetails=validateDetails(raw.verifiedDetails);
  if(interestTags.includes('THON')&&record.verifiedDetails.thon?.value!==true)throw new Error(`${id}: THON tag needs verified involvement`);
  return record;
}
export function validateDetails(input={}){
 const keys=['discover','website','weeklyHours','meetings','size','atmosphere','experience','joining','thon','costs'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new Error('Invalid detail fields');
 return Object.fromEntries(keys.map(k=>{
  const d=input[k];if(d==null)return [k,null];
  const source=officialUrl(d.source),date=text(d.verifiedAt,'detail verification date',10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))throw new Error('Invalid detail date');
  const v=d.value;
  if(['weeklyHours','size'].includes(k)&&(!Number.isFinite(v)||v<0))throw new Error('Invalid numeric detail');
  if(k==='thon'&&typeof v!=='boolean')throw new Error('Invalid THON evidence');
  if(k==='atmosphere'&&!['relaxed','competitive','mixed'].includes(v))throw new Error('Invalid atmosphere');
  if(k==='experience'&&!['required','not_required'].includes(v))throw new Error('Invalid experience');
  if(['meetings','joining'].includes(k))text(v,k,300);
  if(['discover','website'].includes(k)){const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Invalid public link');if(k==='discover'&&u.hostname!=='discover.psu.edu')throw new Error('Invalid Discover link');}
  if(k==='costs'&&(!v||typeof v!=='object'||!('semesterUsd' in v)||(v.semesterUsd!==null&&(!Number.isFinite(v.semesterUsd)||v.semesterUsd<0))||v.additionalCosts!==null&&typeof v.additionalCosts!=='string'))throw new Error('Invalid costs');
  if(k==='costs')text(v.scope,'cost scope',200);
  return [k,{value:v,text:text(d.text,'detail text',500),source,verifiedAt:date}];
 }));
}
export function mergeCatalog(existing,incoming,questions){
  const normalized=incoming.map(r=>normalizeRecord(r,questions));
  const seen=new Set(),map=new Map(existing.map(c=>[c.id,c]));let added=0,updated=0;
  for(const record of normalized){
    if(seen.has(record.id))throw new Error(`Duplicate input ID: ${record.id}`);seen.add(record.id);
    const old=map.get(record.id);
    if(old&&record.verifiedAt<old.verifiedAt)throw new Error(`Refusing older verification for ${record.id}`);
    if([...map.values()].some(c=>c.id!==record.id&&c.name.toLowerCase()===record.name.toLowerCase()))throw new Error(`Duplicate name: ${record.name}`);
    // Legacy exports without details must not erase reviewed fields.
    if(old&&!Object.hasOwn(incoming.find(r=>r.id===record.id),'verifiedDetails'))record.verifiedDetails=old.verifiedDetails;
    if(old&&!Object.hasOwn(incoming.find(r=>r.id===record.id),'sourcePublishedAt'))record.sourcePublishedAt=old.sourcePublishedAt||null;
    // A routine data refresh cannot silently clear a final-audit hold or assert current activity.
    if(old)for(const field of ['recommendationEligible','activityStatus','activityEvidence','auditNotes','finalAudit','officialDirectoryName','profileVerifiedAt'])if(Object.hasOwn(old,field))record[field]=old[field];
    old?updated++:added++;map.set(record.id,record);
  }
  return {clubs:[...map.values()],report:{added,updated,total:map.size,inactive:[...map.values()].filter(c=>c.status==='inactive').length}};
}
