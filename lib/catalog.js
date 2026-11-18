import { readFileSync } from 'node:fs';
import { createSearchIndex } from './search.js';
export const catalogData=JSON.parse(readFileSync(new URL('../clubs.json',import.meta.url)));
export const catalog=catalogData.clubs.filter(c=>c.status!=='inactive');
export const searchIndex=createSearchIndex(catalog);
export function searchCatalog({q='',category='',day='',hours='',offset=0,limit=24}={}) {
  offset=Math.max(0,Math.floor(Number(offset)||0));limit=Math.min(60,Math.max(1,Math.floor(Number(limit)||24)));
  let rows=q?searchIndex.search(q).filter(r=>r.score>0).map(r=>r.club):[...catalog].sort((a,b)=>a.name.localeCompare(b.name));
  rows=rows.filter(c=>(!category||c.category===category)&&(!day||c.meetingDays.includes(day))&&(!hours||c.weeklyHours===hours));
  return {clubs:rows.slice(offset,offset+limit),total:rows.length,catalogTotal:catalog.length,recommendationEligibleTotal:catalog.filter(c=>c.recommendationEligible!==false).length,offset,limit,nextOffset:offset+limit<rows.length?offset+limit:null,catalogVersion:catalogData.catalogVersion,
    categories:[...new Set(catalog.map(c=>c.category))].sort(),days:[...new Set(catalog.flatMap(c=>c.meetingDays))],hours:[...new Set(catalog.map(c=>c.weeklyHours).filter(Boolean))]};
}
