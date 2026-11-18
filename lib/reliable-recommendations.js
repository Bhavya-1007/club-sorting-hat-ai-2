import {catalog,retrieveCandidates,fallbackRecommendations,recommend} from './recommendations.js';
export function deterministicResult(answers,reason='Groq is temporarily unavailable',clubs=catalog){
 return {mode:'fallback',message:`Non-AI matching: ${reason}. These results use verified catalog interests and goals, not AI.`,scoreNote:'Deterministic compatibility estimates, not probabilities or AI assessments. Unknown costs, requirements and schedules are not assumed to fit.',recommendations:fallbackRecommendations(retrieveCandidates(clubs,answers),answers)};
}
export async function reliableRecommendations(answers,options={}){
 try{return await recommend(answers,options);}catch{return deterministicResult(answers,'Groq is temporarily unavailable or its response could not be verified',options.clubs||catalog);}
}
