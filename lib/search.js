const STOP = new Set('a an and are as at be by for from in is it of on or our the their this to with your club penn state university'.split(' '));
export const tokens = text => String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(t => t.length > 1 && !STOP.has(t)) || [];
export function createSearchIndex(clubs) {
  const documents = clubs.map(club => {
    const words=tokens([club.name,club.name,club.description,...club.interestTags,...club.motivationTags,...(club.keywords||[]),...Object.values(club.verifiedDetails||{}).filter(Boolean).map(d=>d.text)].join(' '));
    const tf=new Map(); for(const word of words)tf.set(word,(tf.get(word)||0)+1);
    return {club,tf,length:words.length};
  });
  const df=new Map(); for(const d of documents)for(const word of d.tf.keys())df.set(word,(df.get(word)||0)+1);
  const avg=documents.reduce((n,d)=>n+d.length,0)/Math.max(1,documents.length);
  return {clubs, search(query){
    const terms=[...new Set(tokens(query))];
    return documents.map(d=>({club:d.club,score:terms.reduce((sum,t)=>{
      const f=d.tf.get(t)||0; const idf=Math.log(1+(documents.length-(df.get(t)||0)+.5)/((df.get(t)||0)+.5));
      return sum+idf*(f*2.2)/(f+1.2*(.25+.75*d.length/(avg||1)));
    },0)})).sort((a,b)=>b.score-a.score||a.club.name.localeCompare(b.club.name));
  }};
}
const GOAL_TERMS={
  'Build my resume / career':'professional career industry networking internships',
  'Explore a hobby':'creative recreation music art games',
  'Make friends / social':'community social friendships events concerts',
  'Give back / community service':'volunteer service outreach fundraising leadership',
  'Learn a new skill':'learn practice design workshops training research',
  'Connect with my culture or identity':'cultural international community language heritage',
  'Compete (sports or competitions)':'competitive competition tournament team sport',
};
export function candidateSearch(index, answers, limit=28) {
  limit=Math.min(30,Math.max(1,limit));
  const query=[...(answers.interests||[]),...(answers.motivation||[]).map(m=>GOAL_TERMS[m]||m),answers.major||'',answers.majorRelated==='Yes'?answers.college:''].join(' ');
  const scored=index.search(query).filter(r=>r.club.campus==='University Park'&&r.club.status!=='inactive'&&r.club.recommendationEligible!==false&&(!(answers.interests?.length===1&&answers.interests[0]==='THON')||r.club.verifiedDetails?.thon?.value===true)).map(r=>{
    const i=(answers.interests||[]).filter(t=>r.club.interestTags.includes(t)).length;
    const m=(answers.motivation||[]).filter(t=>r.club.motivationTags.includes(t)).length;
    return {...r,score:r.score+i*4+m*3+(answers.majorRelated==='Yes'&&r.club.relatedColleges.includes(answers.college)?2:0)};
  }).filter(r=>r.score>0);
  const selected=[],counts=new Map();
  // Seed each explicitly selected interest, then diversify within relevant candidates.
  for(const interest of answers.interests||[])for(const row of scored.filter(r=>r.club.interestTags.includes(interest)).sort((a,b)=>b.score-a.score).slice(0,2)) {
    if(!selected.some(c=>c.id===row.club.id)&&selected.length<limit){selected.push(row.club);counts.set(row.club.category,(counts.get(row.club.category)||0)+1);}
  }
  while(selected.length<limit){
    const remaining=scored.filter(r=>!selected.some(c=>c.id===r.club.id));
    if(!remaining.length)break;
    remaining.sort((a,b)=>b.score/(1+.22*(counts.get(b.club.category)||0))-a.score/(1+.22*(counts.get(a.club.category)||0))||a.club.id.localeCompare(b.club.id));
    const club=remaining[0].club;selected.push(club);counts.set(club.category,(counts.get(club.category)||0)+1);
  }
  // No retrieval scores or relevance ordering are supplied to the ranking model.
  return selected.sort((a,b)=>a.id.localeCompare(b.id));
}
