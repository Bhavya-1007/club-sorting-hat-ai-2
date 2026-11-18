export function normalizedName(name){return name.toLowerCase().replace(/\b(pennsylvania state university|penn state|at university park|university park|the)\b/g,'').replace(/[^a-z0-9]/g,'');}
export function auditCatalog(clubs,now=new Date()){
 const byName=new Map(),byProfile=new Map(),duplicates=[];
 for(const c of clubs){
  const name=normalizedName(c.name);if(byName.has(name))duplicates.push({kind:'similar name',ids:[byName.get(name),c.id]});else byName.set(name,c.id);
  if(c.officialUrl.includes('discover.psu.edu/organization/')){if(byProfile.has(c.officialUrl))duplicates.push({kind:'same Discover profile',ids:[byProfile.get(c.officialUrl),c.id]});else byProfile.set(c.officialUrl,c.id);}
 }
 const days=(date)=>(now-new Date(date))/86400000;
 return {total:clubs.length,potentialDuplicates:duplicates,
  reviewOverdue:clubs.filter(c=>days(c.verifiedAt)>180).map(c=>c.id),
  historicalSources:clubs.filter(c=>c.sourcePublishedAt&&days(c.sourcePublishedAt)>730).map(c=>({id:c.id,sourcePublishedAt:c.sourcePublishedAt,source:c.source})),
  publicationDateUnknown:clubs.filter(c=>!c.sourcePublishedAt).length,
  currentRecognitionUnconfirmed:clubs.filter(c=>c.recognitionStatus!=='confirmed_current').length,
  genericDiscoverLinks:clubs.filter(c=>/^https:\/\/discover\.psu\.edu\/(organizations)?\/?$/.test(c.officialUrl)).map(c=>c.id)};
}
