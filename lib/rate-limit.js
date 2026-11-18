import { createHash } from 'node:crypto';
import {configurationIssues} from './config.js';
const buckets = new Map();
let localDay = -1;
let localPaidRequests = 0;
export async function allowRequest(ip, { env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  if(configurationIssues(env).length)throw new Error('Rate-limit configuration unavailable');
  const window = Math.floor(now / 600000);
  const day = Math.floor(now / 86400000);
  const dailyLimit = Math.min(1000, Math.max(1, Number(env.AI_DAILY_REQUEST_LIMIT) || 100));
  const paid = Boolean(env.GROQ_API_KEY?.trim());
  const key = `sorting-hat:${window}:${createHash('sha256').update(ip).digest('hex')}`;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const commands=[['INCR',key],['EXPIRE',key,660]];
    if(paid) commands.push(['INCR',`sorting-hat:paid:${day}`],['EXPIRE',`sorting-hat:paid:${day}`,90000]);
    const response = await fetchImpl(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, { method:'POST', headers:{Authorization:`Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type':'application/json'}, signal:AbortSignal.timeout(3000), body:JSON.stringify(commands) });
    if (!response.ok) throw new Error('Rate limiter unavailable');
    const result = await response.json();
    if (!Number.isInteger(result[0]?.result) || result.some(r => r.error) || (paid && !Number.isInteger(result[2]?.result))) throw new Error('Rate limiter unavailable');
    return result[0].result <= 10 && (!paid || result[2].result <= dailyLimit);
  }
  // Local development only. Serverless deployments must use the shared limiter.
  if (env.VERCEL && env.GROQ_API_KEY?.trim()) throw new Error('Configure distributed rate limiting before enabling paid AI on Vercel');
  if(localDay!==day){localDay=day;localPaidRequests=0;}
  if(paid && ++localPaidRequests>dailyLimit)return false;
  for (const [k, value] of buckets) if (value.window !== window) buckets.delete(k);
  if (!buckets.has(key) && buckets.size >= 10000) return false;
  const bucket = buckets.get(key) || { window, count:0 };
  bucket.count++; buckets.set(key,bucket);
  return bucket.count <= 10;
}
