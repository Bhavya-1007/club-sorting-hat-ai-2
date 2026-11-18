export const DETAIL_LABELS={discover:'Discover profile',website:'Website / social',weeklyHours:'Weekly commitment',meetings:'Meeting days and times',size:'Group size',atmosphere:'Atmosphere',experience:'Previous experience',joining:'Joining process',thon:'THON involvement',costs:'Membership costs'};
export function detailFacts(club){return Object.entries(club.verifiedDetails||{}).filter(([k,v])=>v&&!['discover','website'].includes(k)).map(([key,d])=>({id:`${club.id}:detail:${key}`,text:d.text,source:d.source,verifiedAt:d.verifiedAt,field:key}));}
export function modelFacts(club){return [...club.facts.slice(0,3),...detailFacts(club)];}
export function budgetWarning(club,answers){
 const cap={'Free only':0,'Up to $25':25,'$26–$50':50,'$51–$100':100}[answers.budget];
 const costs=club.verifiedDetails?.costs?.value;
 if(cap===undefined||!costs||costs.semesterUsd===null||costs.semesterUsd<=cap)return null;
 return `Published dues of $${costs.semesterUsd} exceed your $${cap} semester budget (${costs.scope}). Confirm the current charge before joining.`;
}
export function preferenceWarnings(club,answers){
 const warnings=[];const budget=budgetWarning(club,answers);if(budget)warnings.push(budget);
 if(answers.vibe<=2&&club.verifiedDetails?.atmosphere?.value==='competitive')warnings.push('This organization documents competitive activities; you preferred a relaxed atmosphere.');
 if(answers.experience==='None, beginner welcome'&&club.verifiedDetails?.experience?.value==='required')warnings.push('Previous experience is required; you selected beginner.');
 const hoursCap={'Under 2 hours':2,'2-5 hours':5,'5-10 hours':10}[answers.hours];
 const weekly=club.verifiedDetails?.weeklyHours?.value;
 if(hoursCap!==undefined&&typeof weekly==='number'&&(weekly>hoursCap||(answers.hours==='Under 2 hours'&&weekly===2)))warnings.push(`Published weekly commitment (${weekly} hours) exceeds your stated availability.`);
 return warnings;
}
export function evidenceAnswerAllowed(club,id){
 const fields={budget:'costs',freeDays:'meetings',hours:'weeklyHours',size:'size',vibe:'atmosphere',experience:'experience'};
 return !fields[id]||Boolean(club.verifiedDetails?.[fields[id]]);
}
