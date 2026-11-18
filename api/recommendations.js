import { RequestError, validateAnswers, recommend } from '../lib/recommendations.js';
import { allowRequest } from '../lib/rate-limit.js';
import {admitAI} from '../lib/ai-admission.js';
import {deterministicResult,reliableRecommendations} from '../lib/reliable-recommendations.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  const send = (status, body) => { res.statusCode=status; res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return send(405,{error:'Use POST.'}); }
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415,{error:'Use application/json.'});
  if (req.headers['sec-fetch-site'] === 'cross-site') return send(403,{error:'Cross-site requests are not allowed.'});
  try {
    let body = req.body;
    if (body === undefined) {
      const chunks=[]; let size=0;
      for await (const chunk of req) { size += Buffer.byteLength(chunk); if(size>8192) throw new RequestError('Request too large.',413); chunks.push(chunk); }
      body=Buffer.concat(chunks.map(c => Buffer.from(c))).toString();
    }
    if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body))>8192) throw new RequestError('Request too large.',413);
    if (typeof body === 'string') { try { body=JSON.parse(body); } catch { throw new RequestError('Invalid JSON.'); } }
    const answers=validateAnswers(body);
    const ip=process.env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'local';
    try{
      if (!(await allowRequest(ip))) { res.setHeader('Retry-After','600'); return send(429,{error:'Please wait a few minutes before trying another quiz.'}); }
      if(process.env.GROQ_API_KEY?.trim()){
        const admission=await admitAI(ip,answers);
        if(admission!=='admitted')return send(200,deterministicResult(answers,admission==='duplicate'?'an identical AI request was already submitted':'AI capacity is busy; please try AI again later'));
      }
    }catch{return send(200,deterministicResult(answers,'secure AI request controls are unavailable or not configured'));}
    return send(200,await reliableRecommendations(answers));
  } catch(error) {
    // Never log quiz responses, credentials, or provider response bodies.
    return send(error instanceof RequestError ? error.status : 503,{error:error instanceof RequestError ? error.message : 'Recommendations are temporarily unavailable. Please retry or browse clubs.'});
  }
}
