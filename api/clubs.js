import { searchCatalog } from '../lib/catalog.js';
export default function handler(req,res){
  res.setHeader('Content-Type','application/json');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end(JSON.stringify({error:'Use GET.'}));}
  const params=new URL(req.url,'http://localhost').searchParams;
  if((params.get('q')||'').length>200){res.statusCode=400;return res.end(JSON.stringify({error:'Search is too long.'}));}
  res.setHeader('Cache-Control','public, max-age=30');
  res.end(JSON.stringify(searchCatalog(Object.fromEntries(params))));
}
