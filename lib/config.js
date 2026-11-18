export function configurationIssues(env=process.env,{production=Boolean(env.VERCEL)}={}){
 const issues=[];
 if(production&&!env.GROQ_API_KEY?.trim())issues.push('GROQ_API_KEY is required');
 if(env.GROQ_MODEL&&!/^[a-zA-Z0-9_./-]{1,100}$/.test(env.GROQ_MODEL))issues.push('GROQ_MODEL is invalid');
 const url=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN;
 if(production&&(!url||!token))issues.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
 if(Boolean(url)!==Boolean(token))issues.push('Both Upstash settings must be configured together');
 if(url){try{const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.upstash.io')||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error();}catch{issues.push('Upstash URL must be an HTTPS Upstash Redis origin');}}
 for(const [key,min,max] of [['AI_DAILY_REQUEST_LIMIT',1,1000],['AI_MIN_INTERVAL_SECONDS',10,300]])if(env[key]!==undefined&&(!/^\d+$/.test(env[key])||Number(env[key])<min||Number(env[key])>max))issues.push(`${key} must be an integer from ${min} to ${max}`);
 return issues;
}
